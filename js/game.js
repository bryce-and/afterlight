import * as THREE from 'three';
import { G, unlockPointer } from './state.js';
import { LOCATIONS, ELEMENTS, RARITIES, rarityIndex, ACTIVITIES } from './data.js';
import { buildLevel, mat } from './world.js';
import { Enemy, updateEnemyShots, updateEnemyGrenades } from './enemies.js';
import { Player } from './player.js';
import { initEffects, updateEffects, sparks, clearEffects, basicMat, flashLight, ember, swirl } from './effects.js';
import { explosionFx } from './effects.js';
import { pointInColliders, groundAt, footprintHit } from './physics.js';
import { buildNav, NAV, floodReach, cellIndex } from './nav.js';
import { updateNavDebug } from './navdebug.js';
import { rollItem, dismantleValue } from './loot.js';
import { rollShader, SHADERS } from './style.js';
import { addItem, sendToPostmaster, writeSave, playerPower, playerLevel, addXp, ALL_MISSIONS, noteExotic } from './save.js';
import { rollRarity, rewardAt, subclassesUnlockedAt, XP, LIGHT_CAP, capRarity, maxRarityIndex } from './progression.js';
import { sfx } from './audio.js';
import { playMusic, setSection, getSection, musicSectionFor, stinger } from './music.js';
import * as ui from './ui.js';
import { rand, randInt, pick, clamp, mulberry32 } from './util.js';
import { net } from './net.js';
import { MODS, MODS_LEVEL, modsUnlockedAt } from './armor.js';
import { ABILITY_POWER, weaponTierMult, staggerFor, JOLT, waveStep, ENGRAM_CHANCE } from './combat.js';
import { TIERS, rollTier, fireteamScale, killValue, meterKill, AMMO_METER } from './tiers.js';
import { WEAKEN_MULT } from './status.js';
import { buildUnlocksAt } from './subclass.js';
import { castFx } from './abilities.js';
import { FACTIONS, UNITS, classOf, composeWave, zonePlan, activityFaction, baseExtras } from './factions.js';
import { skillIncoming, skillHit } from './enemy-skills.js';
import { buildVoidAxe } from './models.js';
import { updateTower } from './tower.js';
import { showRangeHud } from './tower-ui.js';
import { makeObjective, tickObjective, wantsReinforcement, objectiveText, objectiveTarget, ringPoints, OBJ } from './objectives.js';
import { linesFor, objectiveFor, UNLOCKS } from './story.js';
import { announceSay, onMissionStart, onAbandon, registerEnemy, announceKill, announceLoot, sendHit, fxProjectile, netTick, allPlayers, sendFx, onLevelSwap, announceArena, announceActChest, announceBanner } from './coop.js';

const _c = new THREE.Vector3();
const _sr = new THREE.Vector3(), _su = new THREE.Vector3(), _sd = new THREE.Vector3();
const SHADOW_TEXEL = 100 / 2048; // the shadow box is 100 m across on a 2048 map

/** Moves the sun's shadow box with the player in whole shadow texels, so shadow edges do not swim or pop as you walk. */
function snapSun(L, pos) {
  _sd.copy(L.sunOffset).normalize();
  _sr.set(0, 1, 0).cross(_sd).normalize();
  _su.copy(_sd).cross(_sr);
  const a = Math.round(pos.dot(_sr) / SHADOW_TEXEL) * SHADOW_TEXEL, b = Math.round(pos.dot(_su) / SHADOW_TEXEL) * SHADOW_TEXEL, c = pos.dot(_sd);
  L.sun.target.position.copy(_sr).multiplyScalar(a).addScaledVector(_su, b).addScaledVector(_sd, c);
  L.sun.position.copy(L.sun.target.position).add(L.sunOffset);
}

// ---------------------------------------------------------------------------
// Mission lifecycle
// ---------------------------------------------------------------------------
export function startMission(li, mi) {
  const loc = LOCATIONS[li], def = loc.missions[mi], g = li * 3 + mi;
  cleanupMission();
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
  const pp = playerPower(G.save);
  const delta = clamp(pp - def.power, -40, 10);
  onMissionStart();
  const fireteam = net.count();
  G.mission = {
    fireteam, coop: net.active, remote: net.isClient,
    loc, def, li, mi, g, phase: 'travel', current: 0, revives: 3, lives: livesFor(fireteam), bossModel: def.boss.model, kills: 0, crits: 0, deaths: 0, loot: [],
    xp: 0, startTime: performance.now(), hpMult: 1 + g * 0.1, dmgMult: 1 + g * 0.07,
    playerDmgMult: Math.max(0.25, 1 + delta * 0.02), incomingMult: Math.max(0.6, 1 - delta * 0.025),
    checkpoint: level.spawn.clone(), objective: '', waypoint: null, chest: null, failing: false, doneT: 0,
    zones: level.zones.map((z, i) => ({ ...z, idx: i, state: 'pending', plan: zonePlan(def.id, i, level.zones.length, z.isBoss), waves: makeWaves(i, z.isBoss, g, def, fireteam, loc, zonePlan(def.id, i, level.zones.length, z.isBoss)), waveIdx: 0, enemies: [] })),
  };
  G.time = 0;
  G.player = new Player(G.save);
  G.player.spawn(level.spawn);
  G.state = 'playing';
  playMusic(loc.id);
  stinger('start');
  ui.enterMission();
  ui.centerMessage(def.name, `${loc.name}  ·  Recommended ◆ ${def.power}`, 3.5);
  if (delta < -4) setTimeout(() => ui.feed(`Underpowered by ${-delta}: enemies hit harder and take less damage`, '#ff7a6b'), 1500);
  sfx.areaClear();
  ui.clearSubtitles();
  say('start');
}

export function retryMission() {
  const M = G.mission;
  if (M.act) startActivity(M.act.id, newSeed());
  else startMission(M.li, M.mi);
}

/** Pooled fireteam lives: 3 for two players, 5 for three (solo uses its own revives). */
export function livesFor(n) { return n >= 3 ? 5 : n === 2 ? 3 : 0; }
export const newSeed = () => Math.floor(Math.random() * 1e9);

/** silent: true when the network asked us to leave (don't echo messages back). */
export function abandonMission(silent = false) {
  if (!silent && G.mission && G.state !== 'complete' && G.state !== 'failed') onAbandon();
  cleanupMission();
  ui.showOrbit();
}

export function cleanupMission() {
  ui.endTimer(null);
  if (G.mission?.tower) { showRangeHud(false); G.mpMenu = false; document.getElementById('hud')?.classList.remove('tower-social'); }
  if (G.camera) for (const ch of [...G.camera.children]) G.camera.remove(ch);
  clearEffects();
  G.scene = null; G.level = null; G.player = null; G.mission = null;
  G.colliders = []; G.staticMeshes = []; G.hitTargets = []; G.nav = null;
  G.enemies = []; G.projectiles = []; G.enemyShots = []; G.enemyGrenades = []; G.pickups = []; G.tickers = [];
}

export function missionFailed() {
  G.state = 'failed';
  unlockPointer();
  ui.showFailed(G.mission);
}

function finishMission() {
  G.state = 'complete';
  unlockPointer();
  ui.showComplete(G.mission);
}

// ---------------------------------------------------------------------------
// Waves
// ---------------------------------------------------------------------------
function makeWaves(zi, isBoss, g, def, fireteam = 1, loc = null, plan = null) {
  return withFactions(baseWaves(zi, isBoss, g, def, fireteam, loc), zi, isBoss, g, fireteam, plan);
}

/** U14: a zone's plan (factions.js zonePlan) swaps its opening group and its reinforcements for another faction's roster. The boss keeps its place. */
function withFactions(waves, zi, isBoss, g, fireteam, plan) {
  if (!plan || (!plan.open && !plan.reinf)) return waves;
  const more = fireteamScale(fireteam).count;
  return waves.map((w, wi) => {
    const f = wi === 0 ? plan.open : plan.reinf;
    if (!f) return w;
    let list = composeWave(f, wi, zi, g, more);
    const boss = w.find((s) => s.type === 'boss');
    if (boss) { // the boss zone: a handful of the faction's units around the champion, the rest arrive with its calls for aid
      list = list.sort(() => Math.random() - 0.5).slice(0, Math.round((3 + Math.floor(g / 3)) * more));
      return [{ ...boss, faction: f }, ...list.map((type) => ({ type, faction: f }))];
    }
    return list.map((type) => ({ type, faction: f }));
  });
}

function baseWaves(zi, isBoss, g, def, fireteam = 1, loc = null) {
  // each extra fireteam member adds ~50% more enemies
  const more = fireteamScale(fireteam).count;
  const T = (type, n) => Array.from({ length: Math.round(n * more) }, () => ({ type })); // the shield element comes from the faction (tiers.js SHIELD)
  if (isBoss) {
    return [[{ type: 'boss', name: def.boss.name, element: def.boss.element, model: def.boss.model }, ...T('grunt', 2 + Math.floor(g / 3)), ...T('rusher', 1 + Math.floor(g / 4))]];
  }
  const w1 = [...T('grunt', 3 + Math.floor(g / 3)), ...T('rusher', 1 + Math.floor(g / 4) + (zi > 0 ? 1 : 0))];
  if (zi >= 1 || g >= 2) w1.push(...T('captain', 1));
  const w2 = [...T('grunt', 2 + Math.floor(g / 3)), ...T('rusher', 2 + Math.floor(g / 3))];
  if (g >= 1 || zi >= 1) w2.push(...T('captain', 1 + (g >= 5 && zi >= 1 ? 1 : 0)));
  if (zi >= 1 && g >= 1) w2.push(...T('heavy', 1 + Math.floor(g / 5)));
  // U13a: Hive and Fallen sends a few suicide units (Cursed Thrall, Explosive Shank); Cabal has none
  if (loc?.enemyNames?.suicide) {
    if (zi >= 1) w1.push(...T('suicide', 1));
    if (g >= 1 || zi >= 1) w2.push(...T('suicide', 1 + (g >= 4 && zi >= 1 ? 1 : 0)));
  }
  if (loc?.id) { w1.push(...baseExtras(loc.id, 0, zi, g, more).map((type) => ({ type }))); w2.push(...baseExtras(loc.id, 1, zi, g, more).map((type) => ({ type }))); } // v2.9: Servitor, Shrieker, Incendior, Gladiator
  const waves = [w1, w2];
  if (g >= 4 && zi >= 2) waves.push([...T('grunt', 3), ...T('captain', 1), ...T('heavy', 1)]);
  return waves;
}

export function findSpawn(center, angle, spread, rMin, rMax) {
  const b = G.level.bounds;
  for (let i = 0; i < 24; i++) {
    const a = angle + rand(-spread, spread), r = rand(rMin, rMax);
    const p = new THREE.Vector3(center.x + Math.sin(a) * r, 0, center.z + Math.cos(a) * r);
    p.x = clamp(p.x, b.minX + 2, b.maxX - 2);
    p.z = clamp(p.z, b.minZ + 2, b.maxZ - 2);
    p.y = groundAt(p.x, p.z);
    if (!pointInColliders(_c.copy(p).setY(p.y + 0.5), 0.8) && p.distanceTo(G.player.pos) > 8) return p;
  }
  return center.clone();
}

/** Spawn one unit into a zone (waves, boss adds, clones, revives, summons). `o`: faction, tier, hpFrac, noDrops, and anything Enemy takes. */
export function spawnUnit(z, type, pos, o = {}) {
  const M = G.mission, FT = fireteamScale(M.fireteam);
  const cls = classOf(type), def = UNITS[type];
  const e = new Enemy(type, pos, {
    zone: z, hpMult: M.hpMult * (type === 'boss' ? (1 + M.g * 0.08) * FT.boss : FT.hp) * (o.hpFrac ?? 1), dmgMult: M.dmgMult * (type === 'boss' ? 1 : FT.dmg),
    element: o.element, name: o.name, model: o.model, faction: o.faction,
    tier: o.tier || (def?.support || def?.life ? 'minor' : rollTier(cls, M.g)),
    noDrops: o.noDrops, revived: o.revived, owner: o.owner, life: o.life, totemKind: o.totemKind, isClone: o.isClone,
  });
  G.enemies.push(e);
  z.enemies.push(e);
  registerEnemy(e);
  G.hitDirty = true;
  return e;
}

function spawnWave(z, idx) {
  const M = G.mission, P = G.player;
  const away = Math.atan2(P.pos.x - z.center.x, P.pos.z - z.center.z) + Math.PI;
  let packAt = null; // v3.0.3: Shanks arrive together at one spot instead of scattered along the spawn arc
  for (const sp of z.waves[idx]) {
    let pos;
    if (sp.type === 'fl_shank') {
      packAt ||= findSpawn(z.center, away, idx === 0 ? 1.4 : 2.6, 9, 19);
      pos = findSpawn(packAt, 0, Math.PI, 0.8, 2.4);
    } else pos = sp.type === 'boss' ? z.center.clone() : findSpawn(z.center, away, idx === 0 ? 1.4 : 2.6, 7, 19);
    spawnUnit(z, sp.type, pos, { element: sp.element, name: sp.name, model: sp.model, faction: sp.faction });
  }
  G.hitDirty = true;
  if (idx > 0) {
    const f = z.waves[idx].find((s) => s.faction)?.faction;
    ui.feed(f ? `${FACTIONS[f].name} reinforcements breach the area` : `${M.loc.faction} reinforcements inbound`, '#ffb36b'); sfx.alert();
  }
  return z.waves[idx].length;
}

export function spawnBossAdds(boss) {
  const M = G.mission;
  const z = boss.zone;
  let specs = [];
  const FT = fireteamScale(M.fireteam), more = FT.count;
  if (FACTIONS[boss.faction]) specs = composeWave(boss.faction, 0, Math.max(1, z.idx || 1), M.g, more).sort(() => Math.random() - 0.5).slice(0, Math.round((5 + Math.floor(M.g / 4)) * more)); // U14: a Taken or Scorn champion calls its own
  else for (const [t, n] of [['grunt', 3], ['rusher', 2], ['captain', M.g >= 2 ? 1 : 0]]) for (let i = 0; i < Math.round(n * more); i++) specs.push(t);
  for (const type of specs) {
    const pos = findSpawn(boss.pos, rand(0, Math.PI * 2), Math.PI, 5, 14);
    spawnUnit(z, type, pos, { faction: FACTIONS[boss.faction] ? boss.faction : undefined });
  }
  G.hitDirty = true;
  banner(`${boss.name} calls for aid`, 'Shield restored', 2, 'alert');
}

// ---------------------------------------------------------------------------
// Per-frame update
// ---------------------------------------------------------------------------
export function updateGame(dt) {
  G.time += dt;
  const P = G.player;
  P.update(dt);
  if (G.state !== 'playing') return; // mission may have failed during player update
  G.navBudget = NAV.budget; // path requests allowed this frame, shared by every enemy
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    if (!G.enemies[i].update(dt)) G.enemies.splice(i, 1);
  }
  updateNavDebug(dt);
  updateEnemyShots(dt);
  updateEnemyGrenades(dt);
  updateProjectiles(dt);
  updateTickers(dt);
  updatePickups(dt);
  updateEffects(dt);
  updateMission(dt);
  updateMusic(dt);
  netTick(dt);
  const L = G.level;
  snapSun(L, P.pos);
  L.updateLights(P.pos);
  L.updateDoors(dt);
  ui.updateHUD(dt);
}

/** U16d: seals the way back into a boss room while its fight is on (see syncLocks in world.js). Runs for every player, driven by zone state. */
function syncBossLocks() {
  const L = G.level, M = G.mission;
  if (!L?.syncLocks || M.act) return;
  const want = new Set();
  const live = allPlayers().filter((p) => !p.dead);
  for (const z of M.zones) {
    const r = z.room;
    if (!z.isBoss || z.state !== 'active' || !r || !live.length) continue;
    if (live.every((p) => p.pos.x > r.minX + 0.5 && p.pos.x < r.maxX - 0.5 && p.pos.z > r.minZ + 0.5 && p.pos.z < r.maxZ - 0.5)) want.add(z.idx);
  }
  const res = L.syncLocks(want, allPlayers().map((p) => p.pos));
  if (!res) return;
  G.nav = buildNav(G.colliders, L.bounds);
  G.hitDirty = true;
  if (res === 'sealed') ui.centerMessage('The Way Back Is Sealed', 'Finish the fight', 2.5);
}

function updateMission(dt) {
  const M = G.mission, P = G.player;
  if (M.tower) { updateTower(dt); return; } // U16: the Tower has no zones
  syncBossLocks();
  if (M.act) { updateActivity(dt); return; }
  // fireteam members get zones/objectives from the leader; only the cache is local
  if (M.remote && M.phase !== 'loot' && M.phase !== 'done') return;
  if (M.phase === 'travel' || M.phase === 'combat') {
    const z = M.zones[M.current];
    if (z.state === 'pending') {
      M.objective = `Travel to ${z.name}`;
      M.waypoint = z.center;
      const near = allPlayers().some((p) => Math.hypot(p.pos.x - z.center.x, p.pos.z - z.center.z) < (z.isBoss ? 28 : 24));
      if (near) {
        z.state = 'active';
        M.phase = 'combat';
        spawnWave(z, 0);
        z.waveIdx = 1;
        placeObjective(z);
        say(z.isBoss ? 'boss' : `z${z.idx}`);
        if (z.isBoss) { banner(M.def.boss.name, `${FACTIONS[z.plan?.open]?.name || M.loc.faction} champion`, 3, 'bossIntro'); stinger('boss'); }
        else banner(z.name, `${FACTIONS[z.plan?.open]?.name || M.loc.faction} presence detected`, 2.2, 'alert');
      }
    } else if (z.state === 'active') {
      let alive = 0, nearest = null, nd = Infinity;
      for (const e of z.enemies) {
        if (!e.alive) continue;
        alive++;
        const d = e.pos.distanceTo(P.pos);
        if (d < nd) { nd = d; nearest = e; }
      }
      alive += z.pending || 0; // a Scorn corpse still rising counts as a hostile (enemy-skills.js revive)
      const step = waveStep(alive, z.waveIdx, z.waves.length, z.isBoss);
      if (step.spawn) { alive += spawnWave(z, z.waveIdx); z.waveIdx++; }
      const fighters = allPlayers().filter((p) => !p.dead).length || 1;
      M.aggro = alive / fighters;
      M.objective = z.isBoss ? `Defeat ${M.def.boss.name}` : `Clear ${z.name}  ·  ${alive} hostile${alive === 1 ? '' : 's'}`;
      M.waypoint = !z.isBoss && alive > 0 && alive <= 3 && z.waveIdx >= z.waves.length && nearest ? nearest.pos : null;
      const o = z.obj;
      if (o && !o.done) {
        tickZoneObjective(z, dt, alive);
        if (!o.done) { M.objective = alive > 0 ? `${objectiveText(o)}  ·  ${alive} hostile${alive === 1 ? '' : 's'}` : objectiveText(o); M.waypoint = objectiveTarget(o, P.pos) || M.waypoint; }
      } else if (M.objPrompt) { ui.prompt(null); M.objPrompt = false; }
      if (step.cleared && (!o || o.done)) zoneCleared(z);
    }
  } else if (M.phase === 'loot') {
    M.objective = 'Open the cache';
    M.waypoint = M.chest.pos;
    M.lootT = (M.lootT ?? LOOT_WINDOW) - dt;
    ui.endTimer(M.lootT);
    const near = P.pos.distanceTo(M.chest.pos) < 3.2;
    ui.prompt(near ? '[E]  Open Cache' : null);
    if (near && G.input.pressed.KeyE) openChest();
    else if (M.lootT <= 0) openChest(true); // unclaimed: it opens itself and the rewards wait at the Postmaster
  } else if (M.phase === 'done') {
    ui.endTimer(null);
    ui.prompt(null);
    M.chest.lid.rotation.x = Math.max(-1.9, M.chest.lid.rotation.x - dt * 4);
    M.doneT -= dt;
    if (M.doneT <= 0) finishMission();
  }
}

/** The activity is complete: a downed player gets up where they fell, even with no lives left. Runs on every machine. */
export function reviveForCompletion() {
  const P = G.player;
  if (P.dead) P.respawn(true, true);
}

/** Center banner with its sound, shown to the whole fireteam (members don't run the mission). */
export function banner(title, sub, dur, sound) {
  ui.centerMessage(title, sub, dur);
  sfx[sound]?.();
  announceBanner(title, sub, dur, sound);
}

/** U15: opens the doors tied to a cleared zone (or a named door) and rebuilds the nav grid so enemies path through. */
export function openZoneDoors(idx, id = null) {
  const L = G.level;
  if (!L?.openDoors(idx, id)) return;
  G.nav = buildNav(G.colliders, L.bounds);
  G.hitDirty = true;
  sfx.areaClear?.();
}

function zoneCleared(z) {
  const M = G.mission, P = G.player;
  z.state = 'cleared';
  openZoneDoors(z.idx);
  if (z.isBoss) {
    M.phase = 'loot';
    const dir = P.pos.clone().sub(z.center).setY(0);
    const want = z.center.clone().add(dir.lengthSq() > 1 ? dir.normalize().multiplyScalar(3) : new THREE.Vector3(0, 0, 3));
    const pos = chestSpot(want, P.pos);
    M.chest = spawnChest(pos);
    announceLoot(pos);
    reviveForCompletion();
    ui.centerMessage('Boss Defeated', 'Claim your reward', 3);
    say('bd');
    sfx.missionComplete();
    stinger('complete');
    P.health = P.maxHealth; P.shield = P.maxShield;
  } else {
    banner('Area Secured', '', 2, 'areaClear');
    say(`c${z.idx}`);
    M.current++;
    M.checkpoint = z.center.clone();
    M.phase = 'travel';
  }
}

// ---------------------------------------------------------------------------
// U15 story: subtitles and zone objectives
// ---------------------------------------------------------------------------
/** Plays the script lines for a trigger (host and solo only; fireteam members get them over the network). */
export function say(at) {
  const M = G.mission;
  if (!M || M.remote || M.act) return;
  for (const l of linesFor(M.def.id, at)) { ui.say(l.who, l.text); announceSay(l.who, l.text); }
}

function freePoint(c, rMin, rMax, angle) {
  const b = G.level.bounds;
  for (let i = 0; i < 30; i++) {
    const a = angle + (i ? rand(-0.6, 0.6) : 0), r = rand(rMin, rMax);
    const p = new THREE.Vector3(c.x + Math.sin(a) * r, 0, c.z + Math.cos(a) * r);
    p.y = groundAt(p.x, p.z);
    if (p.x > b.minX + 3 && p.x < b.maxX - 3 && p.z > b.minZ + 3 && p.z < b.maxZ - 3 && !pointInColliders(_c.copy(p).setY(p.y + 0.5), 1.0)) return p;
  }
  return c.clone();
}

const OBJ_COLOR = 0xffd24d;
function objMesh(kind, pos) {
  const g = new THREE.Group();
  if (kind === 'console') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.6), mat(0x2b2f38));
    body.position.y = 0.55; g.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.5), mat(OBJ_COLOR, { emissive: OBJ_COLOR, emissiveIntensity: 1.8 }));
    top.position.y = 1.16; top.name = 'glow'; g.add(top);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 14, 6, 1, true), basicMat(OBJ_COLOR, true));
    beam.material = beam.material.clone(); beam.material.opacity = 0.2; beam.position.y = 7; beam.name = 'beam'; g.add(beam);
  } else if (kind === 'item') {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), mat(OBJ_COLOR, { emissive: OBJ_COLOR, emissiveIntensity: 2 }));
    m.position.y = 1.1; m.name = 'glow'; g.add(m);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 14, 6, 1, true), basicMat(OBJ_COLOR, true));
    beam.material = beam.material.clone(); beam.material.opacity = 0.2; beam.position.y = 7; beam.name = 'beam'; g.add(beam);
  } else { // hold ring: an outline and a fill disc that grows with progress
    const ring = new THREE.Mesh(new THREE.RingGeometry(OBJ.holdRadius - 0.35, OBJ.holdRadius, 48).rotateX(-Math.PI / 2), basicMat(OBJ_COLOR, true));
    ring.position.y = 0.07; ring.material = ring.material.clone(); ring.material.opacity = 0.7; ring.name = 'ring';
    const fill = new THREE.Mesh(new THREE.CircleGeometry(OBJ.holdRadius - 0.4, 48).rotateX(-Math.PI / 2), basicMat(OBJ_COLOR, true));
    fill.material = fill.material.clone(); fill.material.opacity = 0.16; fill.position.y = 0.06; fill.name = 'fill'; fill.scale.setScalar(0.01);
    g.add(ring, fill);
  }
  g.position.copy(pos).setY(groundAt(pos.x, pos.z));
  G.scene.add(g);
  return g;
}

/** Builds a zone's objective (story.js) when the zone activates: places consoles, items, rings and targets. */
function placeObjective(z) {
  const M = G.mission;
  const spec = z.isBoss ? null : objectiveFor(M.def.id, z.idx);
  if (!spec) return;
  const o = makeObjective(spec);
  z.obj = o;
  o.vis = [];
  const away = Math.atan2(G.player.pos.x - z.center.x, G.player.pos.z - z.center.z);
  if (o.t === 'hold') {
    o.pos = z.center.clone();
    o.vis.push(objMesh('ring', o.pos));
  } else if (o.t === 'activate') {
    o.nodes.forEach((n, i) => { n.pos = freePoint(z.center, 8, 15, away + (i / o.nodes.length) * Math.PI * 2 + 0.7); n.mesh = objMesh('console', n.pos); o.vis.push(n.mesh); });
  } else if (o.t === 'retrieve') {
    o.item.pos = freePoint(z.center, 8, 14, away + 2.3);
    o.item.mesh = objMesh('item', o.item.pos); o.vis.push(o.item.mesh);
  } else if (o.t === 'destroy') {
    for (let i = 0; i < (spec.n ?? 3); i++) {
      const pos = freePoint(z.center, 7, 15, away + (i / (spec.n ?? 3)) * Math.PI * 2 + 0.5);
      o.targets.push(spawnUnit(z, 'obj_node', pos, { name: spec.what || 'Objective Target', noDrops: true, tier: 'minor' }));
    }
  }
  G.hitDirty = true;
  ui.feed(`New objective: ${spec.label}`, '#ffd24d');
}

/** Host: the current zone's objective in a few numbers, for fireteam members to draw. */
export function objSnapshot() {
  const M = G.mission, z = M?.zones[M.current], o = z?.obj;
  if (!o || o.done || o.t === 'destroy' || o.t === 'survive') return 0;
  const r2 = (v) => Math.round(v * 100) / 100;
  const pts = o.t === 'hold' ? [[r2(o.pos.x), r2(o.pos.z), 0]] : o.t === 'activate' ? o.nodes.map((n) => [r2(n.pos.x), r2(n.pos.z), n.done ? 1 : 0]) : [[r2(o.item.pos.x), r2(o.item.pos.z), o.item.taken ? 1 : 0]];
  return { k: `${M.current}${o.t}`, t: o.t, pts, p: o.t === 'hold' ? Math.round((o.prog / o.need) * 100) : 0 };
}

/** Fireteam member: draws the leader's objective markers and shows the E prompt. */
export function syncObjMarkers(ob) {
  const M = G.mission;
  if (!M) return;
  if (!ob) { if (M.cliObj) { G.scene.remove(M.cliObj.group); M.cliObj = null; if (M.cliPrompt) { ui.prompt(null); M.cliPrompt = false; } } return; }
  if (!M.cliObj || M.cliObj.k !== ob.k) {
    if (M.cliObj) G.scene.remove(M.cliObj.group);
    const group = new THREE.Group();
    const kind = ob.t === 'hold' ? 'ring' : ob.t === 'activate' ? 'console' : 'item';
    const meshes = ob.pts.map(([x, z]) => { const m = objMesh(kind, new THREE.Vector3(x, 0, z)); G.scene.remove(m); group.add(m); return m; });
    G.scene.add(group);
    M.cliObj = { k: ob.k, group, meshes };
  }
  ob.pts.forEach(([x, z, done], i) => {
    const m = M.cliObj.meshes[i];
    if (ob.t === 'hold') m.getObjectByName('fill').scale.setScalar(Math.max(0.01, ob.p / 100));
    else m.visible = !done;
  });
  const P = G.player;
  const near = ob.pts.find(([x, z, d]) => !d && Math.hypot(P.pos.x - x, P.pos.z - z) < (ob.t === 'hold' ? OBJ.holdRadius : OBJ.interactRange));
  const text = near && !P.dead ? (ob.t === 'activate' ? '[Hold E]  Activate' : ob.t === 'retrieve' ? '[E]  Take' : null) : null;
  if (text) { ui.prompt(text); M.cliPrompt = true; } else if (M.cliPrompt) { ui.prompt(null); M.cliPrompt = false; }
}

function objCtx() {
  const near = (pl, p, r) => !pl.dead && Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < r;
  const held = (pl) => (pl === G.player ? G.input.keys.KeyE : pl.ih);
  const press = (pl) => { if (pl === G.player) return G.input.pressed.KeyE; const v = pl.ihp; pl.ihp = false; return v; };
  return {
    inside: (p, r) => allPlayers().some((pl) => near(pl, p, r)),
    holding: (p, r) => allPlayers().some((pl) => near(pl, p, r) && held(pl)),
    pressed: (p, r) => allPlayers().some((pl) => near(pl, p, r) && press(pl)),
  };
}

function tickZoneObjective(z, dt, alive) {
  const M = G.mission, P = G.player, o = z.obj;
  const was = o.done;
  tickObjective(o, dt, objCtx());
  // pulse the markers and show progress
  const tt = performance.now() / 1000;
  if (o.t === 'hold') {
    const fill = o.vis[0].getObjectByName('fill'), ring = o.vis[0].getObjectByName('ring');
    fill.scale.setScalar(Math.max(0.01, o.prog / o.need));
    ring.material.opacity = 0.5 + Math.sin(tt * 4) * 0.2;
  } else if (o.t === 'activate') {
    for (const n of o.nodes) { const gl = n.mesh.getObjectByName('glow'); if (n.done) { gl.material = mat(0x5cff9a, { emissive: 0x5cff9a, emissiveIntensity: 1.8 }); const b = n.mesh.getObjectByName('beam'); if (b) b.visible = false; } }
  } else if (o.t === 'retrieve') {
    const m = o.item.mesh; if (m) { m.visible = !o.item.taken; const gl = m.getObjectByName('glow'); if (gl) { gl.rotation.y = tt * 2; gl.position.y = 1.1 + Math.sin(tt * 2) * 0.12; } }
  }
  if (o.defend && o.t === 'hold' && !o.mid && o.prog >= o.need / 2) { o.mid = true; spawnWave(z, Math.min(1, z.waves.length - 1)); }
  if (wantsReinforcement(o, dt, alive)) spawnWave(z, Math.min(1, z.waves.length - 1));
  // E prompt for the local player
  let prompt = null;
  const near = (p, r) => p && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < r && !P.dead;
  if (o.t === 'activate') { const n = o.nodes.find((x) => !x.done && near(x.pos, OBJ.interactRange)); if (n) prompt = n.prog > 0 ? `Activating  ${Math.round((n.prog / OBJ.activateTime) * 100)}%` : '[Hold E]  Activate'; }
  else if (o.t === 'retrieve' && !o.item.taken && near(o.item.pos, OBJ.interactRange)) prompt = '[E]  Take';
  else if (o.t === 'hold' && !o.done && !near(o.pos, OBJ.holdRadius) && o.prog < o.need) prompt = 'Return to the ring';
  if (prompt) { ui.prompt(prompt); M.objPrompt = true; } else if (M.objPrompt) { ui.prompt(null); M.objPrompt = false; }
  if (!was && o.done) {
    for (const v of o.vis) v.visible = o.t === 'activate';
    ui.feed('Objective complete', '#7fffa0'); sfx.areaClear();
    if (M.objPrompt) { ui.prompt(null); M.objPrompt = false; }
  }
}

/** How long a mission cache waits before it opens itself, in seconds. */
const LOOT_WINDOW = 30;

/**
 * The open floor nearest `want` that the player can walk to: clear of every collider (a parked ship, crates, a platform)
 * and on the nav grid's reachable cells. Falls back to `want` if the map offers nothing.
 */
function chestSpot(want, from) {
  const nav = G.nav;
  const reach = nav ? floodReach(nav, from.x, from.z) : null;
  const free = (x, z) => {
    const y = groundAt(x, z);
    for (const c of G.colliders) if (c.max.y > y + 0.2 && c.min.y < y + 2 && footprintHit(c, x, z, 1.3)) return false;
    if (!reach) return true;
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const i = cellIndex(nav, x + dx, z + dz); if (i < 0 || !reach[i]) return false; }
    return true;
  };
  if (free(want.x, want.z)) return want;
  for (let r = 1.5; r <= 20; r += 1.5) {
    for (let k = 0, n = Math.ceil(r * 5); k < n; k++) {
      const a = (k / n) * Math.PI * 2, x = want.x + Math.cos(a) * r, z = want.z + Math.sin(a) * r;
      if (free(x, z)) return new THREE.Vector3(x, 0, z);
    }
  }
  return want;
}

export function spawnChest(pos) {
  const g = new THREE.Group();
  const gold = 0xf4c542;
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.0), mat(0x3b3f47));
  base.position.y = 0.4;
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.12, 1.04), mat(gold, { emissive: gold, emissiveIntensity: 1.2 }));
  trim.position.y = 0.78;
  const lid = new THREE.Group();
  lid.position.set(0, 0.84, -0.5);
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 1.0), mat(0x4a4f58));
  lidMesh.position.set(0, 0.12, 0.5);
  lid.add(lidMesh);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 30, 8, 1, true), basicMat(gold, true));
  beam.position.y = 15;
  beam.material = beam.material.clone();
  beam.material.opacity = 0.18;
  g.add(base, trim, lid, beam);
  g.position.copy(pos).setY(groundAt(pos.x, pos.z));
  g.traverse((o) => { if (o.isMesh && o !== beam) o.castShadow = true; });
  G.scene.add(g);
  return { group: g, lid, beam, pos: g.position.clone(), opened: false };
}

function openChest(auto = false) {
  const M = G.mission;
  M.chest.opened = true;
  ui.endTimer(null);
  M.chest.beam.visible = false;
  sfx.chest();
  sparks(M.chest.pos.clone().setY(1), 0xf4c542, 30, 8, 0.1, 0.8);
  const pp = playerPower(G.save);
  const first = !G.save.cleared[M.def.id];
  const n = first ? 3 : 2;
  const base = Math.max(M.def.power, pp);
  const rewards = [];
  for (let i = 0; i < n; i++) {
    const lvl = playerLevel(G.save);
    let rIdx = capRarity(Math.max(i === 0 ? 2 : 1, rollRarity(lvl, first ? 5 : 2)), lvl);
    if (first && M.mi === M.loc.missions.length - 1 && i === 0) rIdx = maxRarityIndex(lvl); // a destination's final mission: the best rarity this level can use (Loot 2.0)
    rewards.push(rollItem(Math.min(LIGHT_CAP, base + randInt(1, 4)), rIdx, null, M.loc.id, G.save.classId, G.save.exoticsFound));
  }
  rewards.forEach((it, i) => setTimeout(() => { if (G.mission === M) grantItem(it, auto); }, 300 + i * 450));
  // shaders: a chance on every mission cache, guaranteed on a destination's final mission the first time
  const shader = rollShader(G.save.shaders.owned, first && M.mi === M.loc.missions.length - 1);
  if (shader) {
    G.save.shaders.owned.push(shader);
    M.rewardShader = shader;
    setTimeout(() => { if (G.mission === M) { ui.feed(`Shader acquired: ${SHADERS[shader].name}`, '#e9d7ff'); sfx.engram(3); } }, 300 + n * 450);
  }
  const glimmer = 120 + M.g * 45;
  G.save.glimmer += glimmer;
  G.save.cleared[M.def.id] = true;
  M.rewardGlimmer = glimmer;
  M.firstClear = first;
  M.rewards = rewards;
  gainXp(XP.mission + (first ? XP.firstClear : 0));
  writeSave(G.save);
  M.phase = 'done';
  M.doneT = 3.8;
  say('end');
  if (M.mi === M.loc.missions.length - 1) for (const [who, text] of UNLOCKS[M.loc.id] || []) { ui.say(who, text); announceSay(who, text); }
}

/** `toPostmaster`: the mission cache opened itself, so the item skips the inventory and waits at the Postmaster. */
export function grantItem(item, toPostmaster = false) {
  if (G.save.settings.autoDismantle?.[item.rarity]) { // weapons and armor alike
    const v = dismantleValue(item);
    G.save.glimmer += v;
    noteExotic(G.save, item); // it still dropped: duplicate protection counts it
    writeSave(G.save);
    ui.feed(`Auto-dismantled ${item.name}  ·  +${v} glimmer`, RARITIES[rarityIndex(item.rarity)].color);
    return;
  }
  if (toPostmaster) noteExotic(G.save, item);
  const auto = toPostmaster ? sendToPostmaster(G.save, item) : addItem(G.save, item);
  if (G.mission && !G.mission.loot.includes(item)) G.mission.loot.push(item);
  ui.lootToast(item);
  sfx.engram(rarityIndex(item.rarity));
  if (toPostmaster) ui.feed(auto.dismantled ? `Cache opened automatically: ${item.name} sent to the Postmaster (${auto.dismantled.name} dismantled)` : `Cache opened automatically: ${item.name} sent to the Postmaster`, '#aaa');
  else if (auto) ui.feed(auto.dismantled ? `Inventory full: ${auto.sent.name} sent to the Postmaster (${auto.dismantled.name} dismantled)` : `Inventory full: ${auto.sent.name} sent to the Postmaster`, '#aaa');
  writeSave(G.save);
}

// ---------------------------------------------------------------------------
// XP and levels
// ---------------------------------------------------------------------------
/** Adds XP to this player's save and announces any levels gained. */
export function gainXp(n) {
  if (!n) return;
  if (G.mission) G.mission.xp = (G.mission.xp || 0) + n;
  const up = addXp(G.save, n);
  if (!up) return;
  sfx.engram(3);
  for (let L = up.from + 1; L <= up.to; L++) {
    const reward = rewardAt(L);
    ui.feed(`Level ${L}${reward ? `  ·  ${RARITIES[rarityIndex(reward)].name} reward ready in Orbit` : ''}`, '#f4c542');
    const sub = subclassesUnlockedAt(L).find((x) => x.classId === G.save.classId);
    const build = buildUnlocksAt(L, G.save.classId)[0];
    const mod = modsUnlockedAt(L)[0];
    if (L === MODS_LEVEL) ui.centerMessage('Mods Unlocked', `Level ${L}  ·  Open Mods on the character screen in Orbit`, 3.5);
    else if (sub) ui.centerMessage(`${sub.name} Unlocked`, `Level ${L}  ·  Choose it from your subclass in Orbit`, 3.5);
    else if (mod) ui.centerMessage(`Mod Unlocked: ${MODS[mod].name}`, `Level ${L}  ·  Socket it from the Mods screen in Orbit`, 3.5);
    else if (build) ui.centerMessage(`${build.type === 'aspect' ? 'Aspect' : 'Fragment'} Unlocked: ${build.name}`, `Level ${L}  ·  Equip it from your subclass in Orbit`, 3.5);
    else ui.centerMessage(`Level ${L}`, reward ? 'A reward awaits you in Orbit' : '', 2.2);
  }
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------
export function getHitTargets() {
  if (G.hitDirty) {
    G.hitTargets = [...G.staticMeshes];
    for (const e of G.enemies) if (e.alive) for (const m of e.hitMeshes) G.hitTargets.push(m);
    G.hitDirty = false;
  }
  return G.hitTargets;
}

export function enemiesNear(pos, r, n = 99, exclude = null) {
  const c = new THREE.Vector3();
  return G.enemies
    .filter((e) => e.alive && e !== exclude && e.center(c).distanceTo(pos) < r + e.radius)
    .sort((a, b) => a.pos.distanceToSquared(pos) - b.pos.distanceToSquared(pos))
    .slice(0, n);
}

export function dealDamage(e, amount, o = {}) {
  if (!e.alive) return { killed: false, dealt: 0 };
  const M = G.mission;
  if (!o.raw && !o.crit && o.source === 'weapon' && e.status.has('judged')) o.crit = true; // Divinity's Judgment bubble: every weapon hit on it is a precision hit
  let dmg = o.raw ? amount : amount * M.playerDmgMult * (o.crit ? o.precMult || 1.5 : 1);
  // grenades and melees hit 40% harder than their listed numbers and keep pace with enemy health
  if (!o.raw && (o.source === 'ability' || o.source === 'melee')) dmg *= ABILITY_POWER * M.hpMult;
  // weapons (and their perks) keep most of the pace of enemy health across mission tiers
  if (!o.raw && (o.source === 'weapon' || o.source === 'perk')) dmg *= weaponTierMult(M.g);
  if (!o.raw) dmg *= exoticArmorMult(o);
  if (!o.raw && G.player?.surgeMult) dmg *= G.player.surgeMult(o); // Surge mods while armor charged
  if (!o.raw && G.player?.setMult) dmg *= G.player.setMult(o); // armor set bonuses
  if (!o.raw && G.player?.buildMult) dmg *= G.player.buildMult(o); // aspects and fragments
  if (!o.raw && e.isBoss && o.source === 'super') dmg *= 0.75;
  // subclass traits on this player's own grenade and melee hits (never on relayed hits or jolt chains)
  // (companions such as Arc Soul are not grenade or melee hits, so they don't carry traits or mod procs either)
  if (!o.raw && !o.jolted && !o.companion && (o.source === 'ability' || o.source === 'melee') && G.player?.traitHitOpts) { Object.assign(o, G.player.traitHitOpts(e, o)); G.player.modOnHit?.(o); }
  // Aftershocks (Striker aspect): this player's own Arc ability and super hits
  if (!o.raw && !o.jolted && !o.companion && o.element === 'arc' && (o.source === 'ability' || o.source === 'melee' || o.source === 'super')) G.player?.aftershock?.();
  // debuffs go on the registry (members show them on the plate; the owner's copy is the real one)
  for (const k of DEBUFFS) if (o[k]) e.status.apply(k, { t: o[k] });
  if (o.suppress) e.flush?.();
  dmg = skillIncoming(e, dmg, o); // U14: wards, ally shields, front guards, totem auras
  skillHit(e);
  if (e.remote) {
    // fireteam member: the leader owns this enemy. Report the hit and predict feedback locally.
    sendHit(e, dmg, o);
    const shieldHit = e.shield > 0;
    if (shieldHit) e.shield = Math.max(0, e.shield - dmg * (o.shieldBreaker ? 4 : o.element === e.shieldEl ? 2.5 : 1));
    else e.hp = Math.max(1, e.hp - dmg);
    e.flash = 0.12;
    const weak = e.status.has('weaken'); // weakened targets show yellow hits
    if (dmg > 0) {
      ui.damageNumber(e, o.pos || e.headPos(new THREE.Vector3()), dmg, { crit: o.crit, weak, shield: shieldHit ? e.shieldEl : null });
      ui.hitmarker(!!o.crit, false, weak);
      sfx.hit(o.crit);
    }
    return { killed: false, dealt: dmg };
  }
  const weak = e.status.has('weaken'); // +30% from every source, and the hit shows yellow
  if (weak) dmg *= WEAKEN_MULT;
  let dealt = 0, shieldHit = false;
  if (e.shield > 0) {
    shieldHit = true;
    const mult = o.shieldBreaker ? 4 : o.element && o.element === e.shieldEl ? 2.5 : 1;
    const sd = dmg * mult;
    if (sd >= e.shield) {
      dealt += e.shield;
      dmg = (sd - e.shield) / mult;
      e.shield = 0;
      e.breakShield(mult > 1, !!o.element && o.element === e.shieldEl);
      if (!o.remoteHit) G.player?.onShieldBreak?.(e);
    } else {
      e.shield -= sd; dealt += sd; dmg = 0;
    }
  }
  if (dmg > 0) { e.hp -= dmg; dealt += dmg; }
  e.flash = 0.12;
  if (o.knock && !e.isBoss) e.knock.add(o.knock);
  const killed = e.hp <= 0;
  if (!killed && !e.isBoss && dealt > 0) {
    const st = staggerFor(e.cls, dealt, e.maxHp, !!o.crit, !(e.staggerCd > 0));
    if (st > 0) e.stagger(st);
  }
  if (!o.remoteHit) {
    ui.damageNumber(e, o.pos || e.headPos(new THREE.Vector3()), dealt, { crit: o.crit, weak, shield: shieldHit ? e.shieldEl : null });
    ui.hitmarker(!!o.crit, killed, weak);
    sfx.hit(o.crit);
  }
  if (dealt > 0 && !o.jolted && e.status.has('jolt') && !(e.joltAt > G.time)) { e.joltAt = G.time + JOLT.cd; joltFrom(e); }
  if (killed) killEnemy(e, o);
  return { killed, dealt };
}

const DEBUFFS = ['weaken', 'slow', 'suppress', 'burn', 'poison', 'jolt', 'blind', 'judged', 'corrosive'];

/** Jolt: a hit on a jolted enemy arcs lightning into it and up to JOLT.n enemies nearby. */
function joltFrom(e) {
  const c = e.center(new THREE.Vector3());
  const pts = [c];
  const near = enemiesNear(c, JOLT.r, JOLT.n, e);
  for (const x of [e, ...near]) {
    if (!x.alive) continue;
    if (x.joltHitAt > G.time) continue; // an enemy takes chain damage at most once per JOLT.cd, however many jolted neighbors trigger
    x.joltHitAt = G.time + JOLT.cd;
    const xc = x.center(new THREE.Vector3());
    if (x !== e) pts.push(xc);
    dealDamage(x, JOLT.dmg, { element: 'arc', source: 'ability', pos: xc, jolted: true });
  }
  if (pts.length > 1) castFx('chain', { pts, el: 'arc', w: 0.04 });
}

export function killEnemy(e, o = {}) {
  if (!e.alive) return;
  e.alive = false;
  e.hp = 0;
  G.hitDirty = true;
  e.onDeath();
  const M = G.mission;
  announceKill(e, o);
  if (o.self) { sfx.enemyDie(e.pos, e.faction); return; } // a suicide unit's own blast: no kill credit, XP or drops
  const mine = !o.by || o.by === net.myId;
  if (mine) {
    M.kills++;
    if (o.crit) M.crits++;
    G.player.onKill(e, o);
  }
  if (!e.noDrops) gainXp(Math.round((XP.kill[e.cls] ?? 0) * (TIERS[e.tier]?.xp ?? 1))); // the whole fireteam shares kill XP; majors are worth more. Clones, revived units, totems and summons give none
  sfx.kill();
  sfx.enemyDie(e.pos, e.faction);
  if (!e.noDrops) rollDrops(e);
  if (e.isBoss) {
    G.player.shake = 0.5;
    explosionFx(e.center(new THREE.Vector3()), 6, M.loc.colors.eye);
    for (const o2 of e.zone.enemies) if (o2.alive) { o2.noBlast = true; killEnemy(o2, {}); }
  }
}

/** Ammo and engram drops. Every fireteam member rolls their own from each kill. Ammo is a hidden meter (tiers.js AMMO_METER): kills fill it, a full meter drops a brick on the next kill. */
export function rollDrops(e) {
  const pos = e.pos.clone().setY(e.pos.y + 0.8);
  const P = G.player;
  if (P) {
    const M = AMMO_METER.size;
    P.ammoMeter ??= { special: Math.random() * M.special * 0.5, heavy: Math.random() * M.heavy * 0.5 }; // start part-filled so the first brick isn't fixed
    const brick = meterKill(P.ammoMeter, killValue(e.tier, e.isBoss), 1 + (P.finderS ?? 0) * 4, 1 + (P.finderH ?? 0) * 4); // Ammo Finder mods fill it faster
    if (brick) spawnPickup(brick, pos);
  }
  if (Math.random() < (ENGRAM_CHANCE[e.cls] ?? 0)) dropEngram(pos);
  if (e.isBoss) {
    dropEngram(pos); dropEngram(pos);
    spawnPickup('heavy', pos); spawnPickup('special', pos);
  }
}

export function getEnemyByNetId(id) {
  return G.enemies.find((e) => e.netId === id);
}

function dropEngram(pos) {
  const M = G.mission;
  const pp = playerPower(G.save);
  const rIdx = rollRarity(playerLevel(G.save));
  const power = clamp(Math.max(pp, M.def.power - 3) + randInt(-1, 2), 1, LIGHT_CAP);
  spawnPickup('engram', pos, rollItem(power, rIdx, null, M.loc.id, G.save.classId, G.save.exoticsFound));
}

export function explode(pos, radius, dmg, element, o = {}) {
  const col = ELEMENTS[element]?.hex ?? 0xffaa55;
  if (o.small) { sparks(pos, col, 6, radius * 2, 0.08, 0.4); flashLight(pos, col, 15 * radius, radius * 3, 0.15); }
  else explosionFx(pos, radius, col);
  // teammates see every explosion; only this machine applies its damage
  sendFx({ t: 'fx', k: 'boom', p: [Math.round(pos.x * 100) / 100, Math.round(pos.y * 100) / 100, Math.round(pos.z * 100) / 100], r: radius, c: col, s: o.small ? 1 : 0 });
  sfx.explosion(radius, pos, element);
  const c = new THREE.Vector3();
  for (const e of G.enemies) {
    if (!e.alive) continue;
    e.center(c);
    const d = Math.max(0, c.distanceTo(pos) - e.radius);
    if (d > radius) continue;
    const f = 1 - 0.5 * (d / radius);
    const kb = c.clone().sub(pos).setY(0).normalize().multiplyScalar((6 * f) / (e.scale ?? e.def.scale));
    e.flush?.(); // splash drives units out of cover
    dealDamage(e, dmg * f, { element, source: o.source || 'explosion', weapon: o.weapon, pos: c.clone().setY(c.y + e.height * 0.3), knock: kb, ...o.debuffs });
  }
  const P = G.player;
  const pd = P.pos.distanceTo(pos);
  if (pd < radius * 3) P.shake = Math.max(P.shake, 0.4 * (1 - pd / (radius * 3)));
}

/** kind: 'melee' (enemy melee attacks) or 'splash' (explosion edges) for the Melee Damage Resistance and Concussive Dampener mods. */
export function damagePlayer(amount, from, kind = null) {
  const P = G.player;
  const k = kind === 'melee' ? P.meleeResist : kind === 'splash' ? P.splashMult : 1;
  P.takeDamage(amount * G.mission.incomingMult * k, from);
}

// ---------------------------------------------------------------------------
// Tickers (timed ability zones etc.)
// ---------------------------------------------------------------------------
export function addTicker(t) { G.tickers.push(t); }

function updateTickers(dt) {
  for (let i = G.tickers.length - 1; i >= 0; i--) {
    const t = G.tickers[i];
    if (!t.update(dt)) { t.dispose?.(); G.tickers.splice(i, 1); }
  }
}

// ---------------------------------------------------------------------------
// Player projectiles
// ---------------------------------------------------------------------------
export function projectileMesh(o) {
  const g = new THREE.Group();
  if (o.kind === 'rocket') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 6).rotateX(Math.PI / 2), mat(0x3b4048));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 6).rotateX(Math.PI / 2), mat(o.color, { emissive: o.color, emissiveIntensity: 1.5 }));
    tip.position.z = 0.32;
    const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), basicMat(0xffc070, true));
    glow.position.z = -0.3;
    g.add(body, tip, glow);
  } else if (o.kind === 'rocketround') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 6).rotateX(Math.PI / 2), mat(0x3b4048));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 6).rotateX(Math.PI / 2), mat(o.color, { emissive: o.color, emissiveIntensity: 1.5 }));
    tip.position.z = 0.19;
    const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), basicMat(0xffc070, true));
    glow.position.z = -0.18;
    g.add(body, tip, glow);
  } else if (o.kind === 'glaivebolt') {
    // Glaive bolt: a white-hot streak inside an element-coloured glow
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(o.size, 0), basicMat(0xffffff));
    core.scale.set(0.8, 0.8, 4.5);
    const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(o.size * 2, 0), basicMat(o.color, true));
    glow.scale.set(0.9, 0.9, 3.2);
    g.add(core, glow);
  } else if (o.kind === 'shield') {
    // Sentinel shield: a void-rimmed disc
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 12).rotateX(Math.PI / 2), mat(0x3a3048));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 4, 16), mat(o.color, { emissive: o.color, emissiveIntensity: 2.4 }));
    const boss = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), basicMat(0xe6d0ff, true));
    g.add(disc, rim, boss);
  } else if (o.kind === 'hammer') {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5), mat(0x5a3a22));
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.18), mat(o.color, { emissive: o.color, emissiveIntensity: 2.5 }));
    head.position.y = 0.3;
    g.add(h, head);
  } else if (o.kind === 'knife') {
    // crude throwing knife: long axis on +z (lookAt points +z along velocity)
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.006, 0.2), mat(0xc9ced4));
    blade.position.z = 0.1;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 4).rotateX(Math.PI / 2), mat(0xc9ced4));
    tip.position.z = 0.23; tip.scale.y = 0.2;
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.2), basicMat(o.color, true));
    edge.position.set(0.019, 0, 0.1);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.016, 0.018), mat(0x3a2a1a));
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.1), mat(0x24272c));
    handle.position.z = -0.06;
    const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.012), mat(o.color, { emissive: o.color, emissiveIntensity: 1 }));
    wrap.position.z = -0.05;
    const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), basicMat(o.color, true));
    glow.position.z = 0.08; glow.scale.set(0.6, 0.6, 2.2);
    g.add(blade, tip, edge, guard, handle, wrap, glow);
  } else if (o.kind === 'axe') {
    // Twilight Arsenal axe: a glowing void head on a pale haft
    g.add(buildVoidAxe());
  } else if (o.kind === 'swarm') {
    // tracking rounds (Swarm, Axion Bolt, SIVA, Wolfpack): a cluster of particles, not one solid shape
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(o.size * (i ? 0.45 : 0.6), 0), basicMat(i ? o.color : 0xffffff, !!i));
      m.position.set((Math.random() - 0.5) * o.size * 3, (Math.random() - 0.5) * o.size * 3, (Math.random() - 0.5) * o.size * 3);
      g.add(m);
    }
  } else if (o.kind === 'seeker' || o.kind === 'drain') {
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(o.size, 0), basicMat(0xffffff)));
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(o.size * 2.2, 0), basicMat(o.color, true)));
  } else if (o.kind === 'nova') {
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(o.size * 0.6, 1), basicMat(0xf0e0ff)));
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(o.size, 1), basicMat(o.color, true)));
  } else {
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(o.size, 0), mat(o.color, { emissive: o.color, emissiveIntensity: 1.8 })));
  }
  return g;
}

export function spawnPlayerProjectile(o) {
  fxProjectile(o);
  const mesh = projectileMesh(o);
  mesh.position.copy(o.pos);
  G.scene.add(mesh);
  G.projectiles.push({ ...o, mesh, age: 0 });
}

function updateProjectiles(dt) {
  const tmp = new THREE.Vector3();
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i];
    p.age += dt;
    if (p.target) {
      if (p.target.alive) {
        const speed = p.vel.length();
        const to = p.target.center(tmp).sub(p.pos).normalize().multiplyScalar(speed);
        p.vel.lerp(to, Math.min(1, dt * (p.turn ?? 6))).setLength(speed);
      } else p.target = null;
    }
    if (p.tracking) {
      const speed = p.vel.length();
      const dir = p.vel.clone().normalize();
      let best = null, bd = Infinity;
      for (const e of G.enemies) {
        if (!e.alive) continue;
        e.center(tmp);
        const to = tmp.clone().sub(p.pos);
        const d = to.length();
        if (d < 70 && to.normalize().dot(dir) > 0.4 && d < bd) { bd = d; best = to; }
      }
      if (best) p.vel.lerp(best.multiplyScalar(speed), Math.min(1, dt * 3.5)).setLength(speed);
    }
    const steps = Math.max(1, Math.ceil((p.vel.length() * dt) / 0.35));
    let hit = null, hitEnemy = null;
    for (let s = 0; s < steps && !hit; s++) {
      p.vel.y -= (p.gravity * dt) / steps;
      p.pos.addScaledVector(p.vel, dt / steps);
      const gy = groundAt(p.pos.x, p.pos.z);
      if (p.pos.y <= gy + 0.05) { hit = 'ground'; p.pos.y = gy + 0.1; break; }
      if (pointInColliders(p.pos, 0, true)) { hit = 'wall'; break; }
      for (const e of G.enemies) {
        if (!e.alive) continue;
        const r = e.radius + (p.size || 0.1);
        if ((p.pos.x - e.pos.x) ** 2 + (p.pos.z - e.pos.z) ** 2 < r * r && p.pos.y >= e.pos.y && p.pos.y <= e.pos.y + e.height) { hit = 'enemy'; hitEnemy = e; break; }
      }
    }
    if (!hit && p.age > p.life) hit = 'timeout';
    if (hit) {
      G.scene.remove(p.mesh);
      G.projectiles.splice(i, 1);
      p.onHit(p.pos.clone(), hitEnemy, hit);
      continue;
    }
    p.mesh.position.copy(p.pos);
    if (p.kind === 'hammer' || p.kind === 'axe') p.mesh.rotation.x -= dt * 18;
    else if (p.kind === 'nova') { p.mesh.rotation.y += dt * 4; p.mesh.scale.setScalar(1 + Math.sin(p.age * 30) * 0.08); }
    else { p.mesh.lookAt(tmp.copy(p.pos).add(p.vel)); if (p.kind === 'knife') p.mesh.rotateX(p.age * 28); }
    // trails
    if (p.kind === 'rocketround') { ember(p.pos, 0xffb060, 0.07, 0.18); if (Math.random() < 0.5) sparks(p.pos, 0x9a9a9a, 1, 0.3, 0.08, 0.3); }
    else if (p.kind === 'glaivebolt') { ember(p.pos, p.color, 0.06, 0.18, 0.2); if (Math.random() < 0.4) ember(p.pos, 0xffffff, 0.03, 0.1, 0.1); }
    else if (p.kind === 'rocket') { sparks(p.pos, 0x9a9a9a, 1, 0.5, 0.14, 0.5); ember(p.pos, 0xffb060, 0.1, 0.2); }
    else if (p.kind === 'grenade' || p.kind === 'glauncher') ember(p.pos, p.color, 0.07, 0.3);
    else if (p.kind === 'knife') { ember(p.pos, p.color, 0.06, 0.25, 0.3); if (Math.random() < 0.5) ember(p.pos, 0xffffff, 0.03, 0.15, 0.2); }
    else if (p.kind === 'seeker' || p.kind === 'drain') { ember(p.pos, p.color, 0.08, 0.3, 0.4); }
    else if (p.kind === 'swarm') {
      p.mesh.rotation.set(p.age * 17, p.age * 23, p.age * 11);
      for (const c of p.mesh.children) c.position.multiplyScalar(0.92).add(tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(p.size * 1.2));
      ember(p.pos, p.color, p.size * 0.7, 0.35, 0.3);
      if (Math.random() < 0.5) ember(p.pos, 0xffffff, p.size * 0.35, 0.2, 0.2);
    }
    else if (p.kind === 'hammer') { for (let i = 0; i < 2; i++) ember(p.pos, i ? 0xffd27a : p.color, 0.14, 0.4, 1.2); }
    else if (p.kind === 'axe') { for (let i = 0; i < 2; i++) ember(p.pos, i ? 0xe6d0ff : p.color, 0.12, 0.4, 0.8); }
    else if (p.kind === 'nova') { for (let i = 0; i < 3; i++) swirl(p.pos, 1.4, i ? p.color : 0xe6d0ff, 0.45, true, 0.12, 0.8); ember(p.pos, p.color, 0.2, 0.5, 1); }
  }
}

// ---------------------------------------------------------------------------
// Pickups: ammo bricks and engrams
// ---------------------------------------------------------------------------
const brickGeo = new THREE.BoxGeometry(0.45, 0.25, 0.3);
const engramGeo = new THREE.IcosahedronGeometry(0.3, 0);
const engramGlow = new THREE.IcosahedronGeometry(0.45, 0);

export function spawnPickup(type, pos, item = null) {
  const g = new THREE.Group();
  if (type === 'engram') {
    const hex = RARITIES[rarityIndex(item.rarity)].hex;
    g.add(new THREE.Mesh(engramGeo, mat(hex, { emissive: hex, emissiveIntensity: 1.4 })));
    const glow = new THREE.Mesh(engramGlow, basicMat(hex, true));
    glow.material = glow.material.clone();
    glow.material.opacity = 0.3;
    g.add(glow);
  } else {
    const col = type === 'special' ? 0x3fd17a : 0xa66bff;
    g.add(new THREE.Mesh(brickGeo, mat(col, { emissive: col, emissiveIntensity: 1.0 })));
  }
  g.position.copy(pos);
  G.scene.add(g);
  G.pickups.push({ type, item, mesh: g, pos: pos.clone(), vel: new THREE.Vector3(rand(-2.5, 2.5), 5, rand(-2.5, 2.5)), age: 0 });
}

function updatePickups(dt) {
  const P = G.player;
  const tgt = new THREE.Vector3(P.pos.x, P.pos.y + 0.9, P.pos.z);
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const k = G.pickups[i];
    k.age += dt;
    const d = k.pos.distanceTo(tgt);
    if (!P.dead && k.age > 0.6 && d < 5) {
      k.pos.addScaledVector(tgt.clone().sub(k.pos).normalize(), Math.min(d, 14 * dt));
    } else {
      k.vel.y -= 15 * dt;
      k.pos.addScaledVector(k.vel, dt);
      const floor = groundAt(k.pos.x, k.pos.z) + 0.55;
      if (k.pos.y < floor) { k.pos.y = floor; k.vel.set(0, 0, 0); }
    }
    k.mesh.position.copy(k.pos);
    k.mesh.position.y += Math.sin(k.age * 3) * 0.08;
    k.mesh.rotation.y += dt * 2;
    k.mesh.rotation.x += dt * 0.7;
    if (!P.dead && k.age > 0.4 && d < 1.3) {
      collect(k);
      G.scene.remove(k.mesh);
      G.pickups.splice(i, 1);
    } else if (k.age > 120) {
      G.scene.remove(k.mesh);
      G.pickups.splice(i, 1);
    }
  }
}

function collect(k) {
  const P = G.player;
  if (k.type === 'engram') { grantItem(k.item); return; }
  P.addAmmo(k.type);
  sfx.pickupAmmo();
  ui.feed(k.type === 'special' ? '+ Special ammo' : '+ Heavy ammo', k.type === 'special' ? '#3fd17a' : '#b48bff');
}

// ---------------------------------------------------------------------------
// Activities (Horde / Endless): waves on the mission maps' boss arenas.
// The host (or solo player) runs the waves; everyone gets their own caches.
// ---------------------------------------------------------------------------
function arenaOrder(seed) {
  const rng = mulberry32(seed);
  const list = ALL_MISSIONS.map((m) => ({ li: m.li, mi: m.mi }));
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

export function startActivity(actId, seed) {
  const act = ACTIVITIES.find((a) => a.id === actId);
  if (!act) throw new Error(`Unknown activity ${actId}`);
  cleanupMission();
  onMissionStart();
  const pp = playerPower(G.save);
  // difficulty starts at the hardest mission the player's Power has reached, then climbs every wave
  const g0 = Math.max(0, ALL_MISSIONS.filter((m) => m.power <= pp).length - 1);
  const fireteam = net.count();
  G.mission = {
    act, seed, arenas: arenaOrder(seed), arenaIdx: 0, wave: 0,
    fireteam, coop: net.active, remote: net.isClient,
    def: { id: act.id, name: act.name, power: pp }, g: g0, g0,
    phase: 'inter', interT: 6, current: 0, revives: 3, lives: livesFor(fireteam), kills: 0, crits: 0, deaths: 0, loot: [],
    startTime: performance.now(), hpMult: 1 + g0 * 0.1, dmgMult: 1 + g0 * 0.07, playerDmgMult: 1, incomingMult: 1,
    objective: '', waypoint: null, chest: null, failing: false, doneT: 0, rewardGlimmer: 0,
  };
  G.time = 0;
  loadArena(0, true);
  G.state = 'playing';
  ui.enterMission();
  ui.centerMessage(act.name, `${G.mission.loc.name}  ·  Wave 1 incoming`, 3.5);
  sfx.areaClear();
  stinger('start');
}

/** Builds arena i (a mission map's boss arena) and puts the player at its edge. */
function loadArena(i, first = false) {
  const M = G.mission;
  const a = M.arenas[i % M.arenas.length];
  const loc = LOCATIONS[a.li], def = loc.missions[a.mi];
  if (!first) {
    for (const e of G.enemies) e.remove();
    if (G.camera) G.scene.remove(G.camera);
    clearEffects();
    onLevelSwap();
  }
  const level = buildLevel(loc, def);
  G.level = level; G.scene = level.scene; G.colliders = level.colliders; G.staticMeshes = level.staticMeshes;
  level.openDoors('all'); // U15: wave arenas start inside the boss room, so its door is open
  for (const d of level.doors) { d.t = 1; d.mesh.visible = false; d.stripe.visible = false; }
  G.nav = buildNav(G.colliders, level.bounds);
  G.hitDirty = true;
  G.scene.add(G.camera);
  initEffects(G.scene);
  G.enemies = []; G.projectiles = []; G.enemyShots = []; G.enemyGrenades = []; G.pickups = []; G.tickers = [];
  const arena = level.zones[level.zones.length - 1];
  const prev = level.zones.length > 1 ? level.zones[level.zones.length - 2].center : level.spawn;
  const dir = prev.clone().sub(arena.center).setY(0);
  if (dir.lengthSq() < 1) dir.set(0, 0, 1);
  const start = arena.center.clone().addScaledVector(dir.normalize(), 13);
  Object.assign(M, { loc, arenaDef: def, arenaIdx: i, checkpoint: start.clone(), bossModel: def.boss.model, chest: null });
  playMusic(loc.id);
  M.zones = [{ center: arena.center.clone(), name: arena.name, isBoss: false, leash: arena.leash, room: arena.room, idx: 0, state: 'active', waves: [], waveIdx: 0, enemies: [] }];
  if (first) G.player = new Player(G.save);
  const P = G.player;
  P.spawn(start);
  P.yaw = Math.atan2(start.x - arena.center.x, start.z - arena.center.z); // face the arena
  if (!first) ui.setMissionHeader();
}

/** Wave n's enemies in two pushes; every arenaEvery-th wave is the arena's boss. Each new arena is denser. */
function activityWave(n) {
  const M = G.mission;
  const more = fireteamScale(M.fireteam).count * (1 + 0.3 * M.arenaIdx);
  const T = (type, k) => Array.from({ length: Math.round(k * more) }, () => ({ type }));
  const k = Math.min(n, 20);
  const alt = activityFaction(M.loc.id, n); // U14: every third wave on Io and the Tangled Shore is the destination's second faction
  if (alt && n % M.act.arenaEvery !== 0) return [0, 1].map((wi) => composeWave(alt, wi, 1, M.g, more).map((type) => ({ type, faction: alt })));
  if (n % M.act.arenaEvery === 0) {
    const b = M.arenaDef.boss;
    return [[{ type: 'boss', name: b.name, element: b.element, model: b.model }, ...T('grunt', 3), ...T('rusher', 2)], [...T('grunt', 3), ...T('captain', 1)]];
  }
  const first = [...T('grunt', 3 + Math.floor(k / 3)), ...T('rusher', 1 + Math.floor(k / 4))];
  const second = [...T('grunt', 2 + Math.floor(k / 4)), ...T('rusher', 1 + Math.floor(k / 5))];
  if (n >= 3) first.push(...T('captain', 1 + Math.floor(k / 9)));
  if (n >= 4) second.push(...T('captain', 1));
  if (n >= 6) second.push(...T('heavy', 1 + Math.floor(k / 14)));
  return [first, second];
}

function startWave() {
  const M = G.mission, z = M.zones[0];
  const n = ++M.wave;
  M.g = M.g0 + Math.floor(n / 5);
  M.hpMult = (1 + M.g0 * 0.1) * (1 + 0.045 * (n - 1));
  M.dmgMult = (1 + M.g0 * 0.07) * (1 + 0.02 * (n - 1));
  z.waves = activityWave(n);
  z.waveIdx = 0;
  z.enemies = [];
  spawnWave(z, 0);
  z.waveIdx = 1;
  M.phase = 'combat';
  if (n % M.act.arenaEvery === 0) { ui.centerMessage(M.arenaDef.boss.name, `Wave ${n}  ·  ${M.loc.faction} champion`, 3); sfx.bossIntro(); stinger('boss'); }
  else { ui.centerMessage(`Wave ${n}`, M.act.waves === Infinity ? '' : `of ${M.act.waves}`, 2); sfx.alert(); }
}

function updateActivity(dt) {
  const M = G.mission, P = G.player, act = M.act;
  updateActChest(dt);
  if (M.phase === 'done') {
    M.doneT -= dt;
    if (M.doneT <= 0) finishMission();
    return;
  }
  if (M.remote) return; // members follow the host's waves through snapshots
  const z = M.zones[0];
  if (M.phase === 'inter') {
    M.interT -= dt;
    M.objective = `Wave ${M.wave + 1}${act.waves === Infinity ? '' : ` of ${act.waves}`} in ${Math.ceil(Math.max(0, M.interT))}s`;
    M.waypoint = null;
    if (M.interT <= 0) startWave();
  } else if (M.phase === 'combat') {
    let alive = 0, nearest = null, nd = Infinity;
    for (const e of z.enemies) {
      if (!e.alive) continue;
      alive++;
      const d = e.pos.distanceTo(P.pos);
      if (d < nd) { nd = d; nearest = e; }
    }
    alive += z.pending || 0;
    const step = waveStep(alive, z.waveIdx, z.waves.length);
    if (step.spawn) { alive += spawnWave(z, z.waveIdx); z.waveIdx++; }
    const fighters = allPlayers().filter((p) => !p.dead).length || 1;
    M.aggro = alive / fighters;
    M.objective = `Wave ${M.wave}  ·  ${alive} hostile${alive === 1 ? '' : 's'}`;
    M.waypoint = alive > 0 && alive <= 3 && z.waveIdx >= z.waves.length && nearest ? nearest.pos : null;
    if (step.cleared) activityWaveCleared();
  } else if (M.phase === 'move') {
    M.moveT -= dt;
    M.objective = `New arena in ${Math.ceil(Math.max(0, M.moveT))}s`;
    if (M.moveT <= 0) { announceArena(M.arenaIdx + 1); moveArena(M.arenaIdx + 1); }
  } else if (M.phase === 'final') {
    M.objective = 'Open the cache';
    M.waypoint = M.chest?.pos ?? null;
  }
}

function activityWaveCleared() {
  const M = G.mission, P = G.player, act = M.act, n = M.wave;
  const final = n >= act.waves;
  ui.centerMessage(final ? `${act.name} Complete` : `Wave ${n} Cleared`, '', 2.5);
  sfx.areaClear();
  stinger('clear');
  if (act.id === 'endless') {
    G.save.records = G.save.records || {};
    if (n > (G.save.records.endless || 0)) { G.save.records.endless = n; writeSave(G.save); }
  }
  if (n % act.chestEvery === 0 || final) {
    const c = M.zones[0].center;
    const dir = P.pos.clone().sub(c).setY(0);
    const pos = c.clone().add(dir.lengthSq() > 1 ? dir.normalize().multiplyScalar(4) : new THREE.Vector3(0, 0, 4));
    placeActChest(pos, n, final);
    announceActChest(pos, n, final);
  }
  if (final) { M.phase = 'final'; return; }
  if (n % act.arenaEvery === 0) { M.phase = 'move'; M.moveT = 12; ui.feed('Moving to a new arena in 12s. Open your cache!', '#f4c542'); }
  else { M.phase = 'inter'; M.interT = n % act.chestEvery === 0 ? 10 : 5; }
}

/** Everyone: move to arena i (any unopened cache is opened for you first). */
export function moveArena(i) {
  const M = G.mission;
  if (M.chest && !M.chest.opened) openActChest();
  loadArena(i);
  M.phase = 'inter';
  M.interT = 6;
  ui.centerMessage(M.zones[0].name, `${M.loc.name}  ·  Enemies are gathering in greater numbers`, 3);
  sfx.areaClear();
  stinger('clear');
}

/** Everyone: a cache for this wave (each player opens and rolls their own). */
export function placeActChest(pos, wave, final) {
  const M = G.mission;
  if (M.chest && !M.chest.opened) openActChest();
  if (M.chest) G.scene.remove(M.chest.group);
  M.chest = { ...spawnChest(pos), wave, final };
  if (final) reviveForCompletion();
}

function updateActChest(dt) {
  const M = G.mission, c = M.chest, P = G.player;
  if (!c) return;
  if (c.opened) { c.lid.rotation.x = Math.max(-1.9, c.lid.rotation.x - dt * 4); return; }
  const near = !P.dead && P.pos.distanceTo(c.pos) < 3.2;
  ui.prompt(near ? '[E]  Open Cache' : null);
  if (near && G.input.pressed.KeyE) openActChest();
  if (c.final && M.remote) { M.objective = 'Open the cache'; M.waypoint = c.pos; }
}

function openActChest() {
  const M = G.mission, c = M.chest;
  c.opened = true;
  c.beam.visible = false;
  ui.prompt(null);
  sfx.chest();
  sparks(c.pos.clone().setY(1), 0xf4c542, 30, 8, 0.1, 0.8);
  const pp = playerPower(G.save);
  const n = c.final ? 3 : 2;
  const rewards = [];
  for (let i = 0; i < n; i++) {
    const lvl = playerLevel(G.save);
    let rIdx = Math.max(i === 0 ? 2 : 1, rollRarity(lvl, 2 + Math.floor(c.wave / 5)));
    if (c.final && i === 0) rIdx = 4; // the end of Horde always pays out an exotic
    if (M.act.id === 'endless' && c.wave > 30 && c.wave % 10 === 0 && i === 0) rIdx = 4; // Endless: an exotic every 10 waves past 30
    rIdx = capRarity(rIdx, lvl); // never above what this level can use
    rewards.push(rollItem(Math.min(LIGHT_CAP, pp + randInt(1, 4)), rIdx, null, null, G.save.classId, G.save.exoticsFound));
  }
  rewards.forEach((it, i) => setTimeout(() => { if (G.mission === M) grantItem(it); }, 300 + i * 450));
  const glimmer = 60 + c.wave * 12;
  G.save.glimmer += glimmer;
  M.rewardGlimmer += glimmer;
  gainXp(XP.actCache);
  writeSave(G.save);
  if (c.final) { M.phase = 'done'; M.doneT = 3.8; }
}

// ---------------------------------------------------------------------------
// Exotic armor damage effects (see EXOTIC_ARMOR_PERKS)
// ---------------------------------------------------------------------------
const MELEE_SUPERS = new Set(['fists', 'staff', 'sentinel']);
function exoticArmorMult(o) {
  const P = G.player;
  if (!P?.exo?.size) return 1;
  let m = 1;
  const S = P.superActive;
  const hawk = o.source === 'super' && P.status.get('nighthawk');
  if (hawk) { m *= hawk.value; P.status.remove('nighthawk'); } // Celestial Nighthawk: the first super hit, once
  if (P.exo.has('synthoceps')) {
    const melee = o.source === 'melee' || (o.source === 'ability' && P.meleeT > 0) || (o.source === 'super' && MELEE_SUPERS.has(S?.type));
    if (melee && enemiesNear(P.pos, 12).length >= 3) m *= 2; // Synthoceps: surrounded
  }
  if (P.exo.has('heart') && o.source === 'ability' && (P.status.has('heart', 'grenade') || P.status.has('heart', 'melee'))) m *= 1.3; // Heart of Inmost Light
  return m;
}

// ---------------------------------------------------------------------------
// Music section from what is around the player (works the same for fireteam members)
// ---------------------------------------------------------------------------
let musicT = 0;
function updateMusic(dt) {
  musicT -= dt;
  if (musicT > 0) return;
  musicT = 0.5;
  const P = G.player;
  let nearest = Infinity, bossDist = Infinity;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
    if (e.isBoss) bossDist = Math.min(bossDist, d);
    else nearest = Math.min(nearest, d);
  }
  setSection(musicSectionFor(getSection(), nearest, bossDist));
}
