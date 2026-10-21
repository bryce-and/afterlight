// U16 "The Last City": the Tower, the campaign's social hub (Destiny 1 layout, js/level-tower.js).
// It runs as a mission-shaped shell (G.mission.tower) with no zones and no enemies except the Range's training dummies, so
// the player, HUD, camera and effects need no second code path. Third person everywhere, first person with weapons in the Range.
import * as THREE from 'three';
import { G, lockPointer, unlockPointer } from './state.js';
import * as ui from './ui.js';
import { buildLevel } from './world.js';
import { buildNav } from './nav.js';
import { Player } from './player.js';
import { Enemy } from './enemies.js';
import { initEffects } from './effects.js';
import { playMusic } from './music.js';
import { sfx } from './audio.js';
import { cleanupMission } from './game.js';
import { TOWER_LOC } from './level-tower.js';
import { TOWER_SPOTS } from './tower-data.js';
import { buildNpc, NPC_INFO } from './models-npc.js';
import { talkTo, npcHasQuest, dueStop } from './quests.js';
import { TOWER_TALKS, TOWER_IDLE, KADI_LINES } from './story.js';
import { writeSave } from './save.js';
import { openPostmaster, openExoticKiosk, openQuestKiosk, showRangeHud, setRangeHud } from './tower-ui.js';
import { pick } from './util.js';

export const inTower = () => !!G.mission?.tower;
const _v = new THREE.Vector3();

export function startTower() {
  cleanupMission();
  const def = { id: 'tower', name: 'The Tower', power: 0, boss: { name: '', model: null }, mood: null };
  const level = buildLevel(TOWER_LOC, def);
  G.level = level;
  G.scene = level.scene;
  G.colliders = level.colliders;
  G.staticMeshes = level.staticMeshes;
  G.nav = buildNav(G.colliders, level.bounds);
  G.hitDirty = true;
  G.scene.add(G.camera);
  initEffects(G.scene);
  G.enemies = []; G.projectiles = []; G.enemyShots = []; G.enemyGrenades = []; G.pickups = []; G.tickers = [];
  G.mission = {
    tower: { npcs: [], dummies: [], pads: [], inRange: false, talkCd: 0, panel: false, run: { total: 0, best: 0, samples: [], idle: 0 } },
    loc: TOWER_LOC, def, li: -1, mi: -1, g: 0, phase: 'tower', current: 0, zones: [],
    fireteam: 1, coop: false, remote: false, revives: 3, lives: 0, bossModel: null, kills: 0, crits: 0, deaths: 0, loot: [],
    xp: 0, startTime: performance.now(), hpMult: 1, dmgMult: 1, playerDmgMult: 1, incomingMult: 1,
    checkpoint: level.spawn.clone(), objective: '', waypoint: null, chest: null, failing: false, doneT: 0,
  };
  G.time = 0;
  G.player = new Player(G.save);
  G.player.spawn(level.spawn);
  buildTowerCast();
  G.state = 'playing';
  playMusic('tower');
  ui.enterMission();
  document.getElementById('hud').classList.add('tower-social');
  ui.clearSubtitles();
  ui.centerMessage('The Tower', 'The Last City', 3);
  const due = dueStop(G.save);
  if (due) ui.say('ghost', `${due.text}. They are waiting.`);
}

/** Leaves the Tower for Orbit. */
export function leaveTower() {
  showRangeHud(false);
  ui.prompt(null);
  G.mpMenu = false;
  cleanupMission();
  ui.showOrbit();
}

// ---------------------------------------------------------------------------
// The people and terminals
// ---------------------------------------------------------------------------
const POSTS = [
  ['zavala', 'Talk to Zavala'], ['ikora', 'Talk to Ikora Rey'], ['cayde', 'Talk to Cayde-6'], ['kadi', 'Open the Postmaster'],
];

function buildTowerCast() {
  const T = G.mission.tower, S = TOWER_SPOTS;
  for (const [id, label] of POSTS) {
    const spot = S[id];
    if (!spot) continue;
    const model = buildNpc(id);
    model.group.position.set(spot.x, spot.y ?? 0, spot.z);
    model.group.rotation.y = (spot.yaw || 0) + Math.PI; // the map's yaw 0 faces -z, the models face +z
    G.scene.add(model.group);
    // the quest marker: a gold diamond that bobs over the head of whoever has something for you
    const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0xffd24d, fog: false }));
    mark.scale.y = 1.5;
    mark.position.set(spot.x, (spot.y ?? 0) + model.height + 0.6, spot.z);
    G.scene.add(mark);
    T.npcs.push({ id, label, x: spot.x, z: spot.z, yaw: (spot.yaw || 0) + Math.PI, model, mark, r: S.talkRadius || 3.2 });
  }
  T.pads = [
    { id: 'quest', x: S.questKiosk.x, z: S.questKiosk.z, r: 2.4, label: 'Open the Quest Kiosk', act: () => openPanel(openQuestKiosk) },
    { id: 'exotic', x: S.exoticKiosk.x, z: S.exoticKiosk.z, r: 2.4, label: 'Open the Exotic Kiosk', act: () => openPanel(openExoticKiosk) },
    { id: 'launch', x: S.launchPad.x, z: S.launchPad.z, r: S.launchPad.r || 2.5, label: 'Launch to Orbit', act: leaveTower },
  ];
}

/** Opens a terminal: the world keeps running (G.mpMenu freezes input), and the pointer comes back when it closes. */
function openPanel(open) {
  const T = G.mission.tower;
  T.panel = true; G.mpMenu = true;
  unlockPointer();
  ui.prompt(null);
  open(() => { T.panel = false; G.mpMenu = false; lockPointer(); });
}

function talk(n) {
  const T = G.mission.tower;
  if (n.id === 'kadi') {
    if (!G.save.metKadi) { G.save.metKadi = true; for (const [w, t] of KADI_LINES) ui.say(w, t); writeSave(G.save); }
    openPanel(openPostmaster);
    return;
  }
  if (T.talkCd > 0) return;
  const r = talkTo(G.save, n.id);
  if (r.counted) {
    const lines = TOWER_TALKS[r.stop.id]?.[n.id] || [];
    for (const [who, text] of lines) ui.say(who, text);
    writeSave(G.save);
    if (r.finished) {
      ui.say('ghost', 'That is everyone. The Director is open again.');
      ui.centerMessage('Quest Updated', 'The Vanguard have your report', 4);
      sfx.areaClear();
    }
  } else {
    ui.say(n.id, pick(TOWER_IDLE[n.id]));
  }
  T.talkCd = 1.2;
}

// ---------------------------------------------------------------------------
// Range
// ---------------------------------------------------------------------------
const RANGE_TYPES = ['grunt', 'grunt', 'captain', 'captain', 'heavy', 'boss'];

function spawnDummies() {
  const T = G.mission.tower, S = TOWER_SPOTS;
  const zone = { enemies: [] };
  S.rangeDummies.forEach((spot, i) => {
    spawnDummy(zone, spot, RANGE_TYPES[i % RANGE_TYPES.length]);
  });
  if (S.rangeBoss) spawnDummy(zone, S.rangeBoss, 'boss');
  G.hitDirty = true;
  function spawnDummy(z, spot, type) {
    const e = new Enemy(type, new THREE.Vector3(spot.x, spot.y ?? 0, spot.z), { zone: z, hpMult: 4e5, dmgMult: 0, faction: 'scrappers', name: type === 'boss' ? 'Training Boss' : 'Training Dummy', tier: type === 'boss' ? undefined : 'minor', noDrops: true });
    e.dummy = true;
    e.noDrops = true;
    e.pos.y = spot.y ?? 0;
    e.yaw = TOWER_SPOTS.rangeFirePoint ? Math.atan2(TOWER_SPOTS.rangeFirePoint.x - spot.x, TOWER_SPOTS.rangeFirePoint.z - spot.z) : 0;
    e.model.group.rotation.y = e.yaw;
    e.model.group.traverse((o) => { // grey the paint so they read as training targets, not Fallen
      const m = o.material;
      if (m && m.color && !m.userData.dummyTint) { m.userData.dummyTint = true; m.color.lerp(new THREE.Color(0xb9b2a4), 0.55); }
    });
    let seen = e.hp + e.shield;
    e.update = function dummyUpdate(dt) {
      this.spawnT = 1;
      this.model.group.scale.setScalar(this.scale);
      this.model.group.position.copy(this.pos);
      this.flash = Math.max(0, this.flash - dt);
      const f = Math.min(1, this.flash * 8);
      this.model.bodyMat.emissive.setRGB(f, f, f);
      if (this.model.shield) { this.model.shield.visible = this.shield > 0; this.model.shield.rotation.y += dt; }
      this.status.tick(dt);
      const dealt = seen - (this.hp + this.shield);
      if (dealt > 0) addRangeDamage(dealt);
      this.hp = this.maxHp; this.shield = this.maxShield; seen = this.hp + this.shield; // never dies
      this.staggerT = 0; this.knock.set(0, 0, 0);
      return true;
    };
    G.enemies.push(e);
    z.enemies.push(e);
  }
}

function addRangeDamage(d) {
  const R = G.mission.tower.run;
  R.samples.push({ t: G.time, d });
  R.total += d; R.idle = 0;
}

function tickRange(dt) {
  const T = G.mission.tower, R = T.run, P = G.player;
  R.idle += dt;
  const cutoff = G.time - 5;
  while (R.samples.length && R.samples[0].t < cutoff) R.samples.shift();
  const sum = R.samples.reduce((a, s) => a + s.d, 0);
  const span = R.samples.length ? Math.max(1, G.time - R.samples[0].t) : 1;
  const dps = sum / span;
  if (dps > R.best) R.best = dps;
  if (R.idle > 8 && R.total > 0) { R.total = 0; } // a quiet moment starts a fresh run
  setRangeHud(R.samples.length ? dps : 0, R.total, R.best);
  for (const w of P.weapons) { w.ammo = w.mag; if (w.reserve !== Infinity) w.reserve = w.maxReserve; } // infinite ammo at the Range
}

function setRange(on) {
  const T = G.mission.tower;
  T.inRange = on;
  document.getElementById('hud').classList.toggle('tower-social', !on);
  showRangeHud(on);
  if (on && !T.dummies.length) { T.dummies = [1]; spawnDummies(); }
  ui.centerMessage(on ? 'Shooting Range' : 'The Tower', on ? 'Weapons free. Targets stand at your Light.' : 'Weapons holstered', 2);
}

// ---------------------------------------------------------------------------
// Per frame
// ---------------------------------------------------------------------------
export function updateTower(dt) {
  const M = G.mission, T = M.tower, P = G.player, S = TOWER_SPOTS;
  T.talkCd = Math.max(0, T.talkCd - dt);
  const pp = P.pos;

  // people: idle animation, turn toward a Guardian who walks up, quest marker
  for (const n of T.npcs) {
    n.model.update(dt, G.time);
    const d = Math.hypot(pp.x - n.x, pp.z - n.z);
    const want = d < 9 ? Math.atan2(pp.x - n.x, pp.z - n.z) : n.yaw;
    let diff = ((want - n.model.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    n.model.group.rotation.y += diff * Math.min(1, dt * 3);
    const has = npcHasQuest(G.save, n.id);
    n.mark.visible = has;
    if (has) { n.mark.rotation.y += dt * 1.6; n.mark.position.y = n.model.group.position.y + n.model.height + 0.6 + Math.sin(G.time * 2.4) * 0.08; }
  }

  // the Range: inside the box you hold your weapons and see through your own eyes
  const rb = S.rangeBox;
  const inside = pp.x >= rb.minX && pp.x <= rb.maxX && pp.z >= rb.minZ && pp.z <= rb.maxZ;
  if (inside !== T.inRange) setRange(inside);
  if (T.inRange) tickRange(dt);

  // interaction: the closest thing in reach
  let best = null, bd = Infinity;
  const consider = (o, r, label, act) => { const d = Math.hypot(pp.x - o.x, pp.z - o.z); if (d < r && d < bd) { bd = d; best = { label, act }; } };
  if (!T.inRange) {
    for (const n of T.npcs) consider(n, n.r, n.label, () => talk(n));
    for (const p of T.pads) consider(p, p.r, p.label, p.act);
  } else {
    const lp = T.pads.find((p) => p.id === 'launch');
    if (lp) consider(lp, lp.r, lp.label, lp.act);
  }
  if (T.panel) best = null;
  ui.prompt(best ? `[E]  ${best.label}` : null);
  if (best && G.input.pressed.KeyE) best.act();
}
