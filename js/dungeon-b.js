// U23 chunk B: the runtime of The Underbelly (traversal) and The Pleasure Gardens (encounter). js/dungeon.js owns the dungeon shell and
// calls in here per segment; the helpers it shares (spawning, chalices, Favor, clears, capped boss hits) come in through bindB().
// Host or solo decide (Watchers, levers, flowers, beasts, the boss, the down timer); members mirror the 'ds' snapshot fields this file
// adds (snapB / onSnapB) and send their lever pulls and flower lights as 'dh'. The shared clock D.clock drives pistons, vents and sweeps.
import * as THREE from 'three';
import { G } from './state.js';
import * as ui from './ui.js';
import { sfx } from './audio.js';
import { net, send, broadcast, sendTo } from './net.js';
import { ringFx, flashLight, sparks } from './effects.js';
import { hasLOS } from './physics.js';
import { allPlayers, damageRemote } from './coop.js';
import { spawnUnit, damagePlayer, banner } from './game.js';
import { makeDungeonDrop } from './dungeon-loot.js';
import { playerPower } from './save.js';
import {
  buildUnderbellyMech, updateUnderbellyMech, setPlaque, leverFx, leverAt, dressWatcher, tintWatcher, disposeMechB,
  buildGardensMech, updateGardensMech, setFlower, budAt, setChannel, beastEye, setDoor,
} from './dungeon-mech-b.js';
import { removeChalice } from './dungeon-mech.js';
import {
  watchYaw, inCone, awareStep, sectionOutcome, hurtAlarm, beastAt, beastLoop, flowerCount, pickFlowers, newLevers, pullLever, downStep,
  DpsBossFsm, cappedHit, leashStep, inRegion, SIGIL_NAMES,
} from './dungeon-rules.js';

let H = null; // helpers from dungeon.js
export function bindB(h) { H = h; }
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const keyOf = (p) => (p === G.player ? H.localId() : p.id);
const onFoot = (f, p) => p.x >= f.x0 - 0.5 && p.x <= f.x1 + 0.5 && p.z <= Math.max(f.z0, f.z1) + 0.5 && p.z >= Math.min(f.z0, f.z1) - 0.5 && Math.abs(p.y - f.top) < 1.6;

// ---------------------------------------------------------------------------
// Segment state
// ---------------------------------------------------------------------------
/** Builds the segment's objects and state (everyone). Returns true when this file owns the segment. */
export function initSegB(S, seg, foot) {
  if (seg.id === 'underbelly') {
    S.mech = buildUnderbellyMech(seg);
    S.decks = Object.fromEntries(seg.decks.map((d) => [d.id, { spawned: false, alarm: false, unseen: false, reinforced: false, watchers: [], tasterT: 0, foot: d.foot.map((id) => foot.find((f) => f.id === id)) }]));
    S.deckAt = -1; S.levers = newLevers(3); S.secret = null; S.secretOpen = false;
    setPlaque(S.mech, S.levers.order);
    return true;
  }
  if (seg.id === 'gardens') {
    S.mech = buildGardensMech(seg);
    Object.assign(S, { flowers: [], bloom: 0, beasts: [], aware: seg.beasts.map(() => 0), howl: null, downs: {}, beastT: 0, chan: { i: -1, t: 0 }, downLeft: null });
    return true;
  }
  return false;
}
export const disposeSegB = (S) => { disposeMechB(S.mech); if (S.secret) G.scene?.remove(S.secret.group); };
export const ownsB = (seg) => seg.id === 'underbelly' || seg.id === 'gardens';

/** Host or solo: back to how the segment was entered (a solo death or a wipe). The Underbelly keeps the deck checkpoint you reached. */
export function resetSegB(D, S, seg) {
  if (seg.id === 'underbelly') {
    for (const c of S.mech.chalices.slice()) removeChalice(S.mech, c.id);
    const reached = seg.decks.findIndex((d) => d.id === (S.lastDeck || 'a'));
    seg.decks.forEach((d, k) => { if (k >= reached) Object.assign(S.decks[d.id], { spawned: false, alarm: false, unseen: false, reinforced: false, watchers: [], tasterT: 0 }); });
    if (!S.levers.solved) { S.levers.progress = 0; leverFx(S.mech, -1, 'reset'); }
    S.s = 'active'; // a traversal stays live: you respawn on the deck you reached
  }
  if (seg.id === 'gardens') {
    for (const c of S.mech.chalices.slice()) removeChalice(S.mech, c.id);
    Object.assign(S, { flowers: [], bloom: 0, beasts: [], aware: seg.beasts.map(() => 0), howl: null, downs: {}, beastT: 0, downLeft: null, fsm: null, boss: null });
    S.chan = { i: -1, t: 0 }; setChannel(S.mech, -1, 0);
    S.mech.flowers.forEach((_, i) => setFlower(S.mech, i, 'off'));
    G.player?.status.remove('bloom');
  }
}
/** Member: the host reset the encounter. */
export function onResetB(S, seg) {
  if (seg.id === 'gardens') { S.chan = { i: -1, t: 0 }; setChannel(S.mech, -1, 0); G.player?.status.remove('bloom'); }
  if (seg.id === 'underbelly' && !S.levers.solved) leverFx(S.mech, -1, 'reset');
}

// ---------------------------------------------------------------------------
// Activation (host or solo)
// ---------------------------------------------------------------------------
export function activateB(D, i) {
  const seg = D.layout.segments[i], S = D.segs[i];
  S.s = 'active';
  if (seg.id === 'underbelly') banner(seg.name, 'Gold grates hold only under Favor. Mind the Watchers', 3.2, 'areaClear');
  if (seg.id === 'gardens') startGardens(D, i);
}

// ---------------------------------------------------------------------------
// The Underbelly
// ---------------------------------------------------------------------------
function spawnDeck(D, S, seg, cfg, deck) {
  const zone = D.zones[D.seg], st = S.decks[deck.id];
  st.spawned = true;
  H.spawnKit(zone, cfg.decks[deck.id], deck.spawns);
  for (const sp of deck.snipers) for (const t of H.expand(cfg.snipers)) H.spawnAt(zone, t, sp);
  st.watchers = seg.watchers[deck.id].map((w) => {
    const e = spawnUnit(zone, 'lg_watcher', new THREE.Vector3(w.p[0], w.p[1], w.p[2]), { faction: D.def.faction, noDrops: true });
    e.pos.y = w.p[1]; e.fireT = 1e9;
    e.dgWatch = { deck: deck.id, spec: w, aware: 0, alarmed: false, hurtFor: 0, losT: 0, seen: false };
    const upd = e.update.bind(e);
    e.update = (dt) => {
      const out = upd(dt);
      if (e.alive) { e.yaw = e.dgWatch.alarmed && e.tgt ? Math.atan2(e.tgt.pos.x - e.pos.x, e.tgt.pos.z - e.pos.z) : watchYaw(w, D.clock); e.model.group.rotation.y = e.yaw; e.fireT = 1e9; }
      return out;
    };
    return e;
  });
  G.hitDirty = true;
}
function alarmDeck(D, S, seg, cfg, id, why) {
  const st = S.decks[id];
  if (st.alarm) return;
  st.alarm = true;
  for (const e of st.watchers) e.dgWatch.alarmed = true;
  if (!st.reinforced) { st.reinforced = true; H.spawnKit(D.zones[D.seg], cfg.reinforce, seg.decks.find((d) => d.id === id).spawns); }
  const w = st.watchers.find((e) => e.alive) || st.watchers[0];
  sfx.watcherAlarm?.(w ? w.pos.clone() : undefined);
  banner('Seen', why === 'hurt' ? 'A wounded Watcher calls the guard' : 'A Watcher has called reinforcements', 2.2, 'alert');
  if (net.isHost) broadcast({ t: 'dfx', k: 'alarm', d: id });
}
function underbellyTick(D, S, seg, cfg, dt) {
  const players = H.alivePlayers();
  // the deck each player stands on: spawn it on first arrival, move the checkpoint forward
  seg.decks.forEach((deck, k) => {
    const st = S.decks[deck.id];
    const here = players.some((p) => st.foot.some((f) => onFoot(f, p.pos)));
    if (!here) return;
    if (!st.spawned) spawnDeck(D, S, seg, cfg, deck);
    if (k > seg.decks.findIndex((d) => d.id === (S.lastDeck || 'a')) || !S.lastDeck) { S.lastDeck = deck.id; G.mission.checkpoint.set(...deck.checkpoint); if (k > 0) ui.feed('Checkpoint', '#ffd24d'); }
    // a Royal Taster on this deck when none is alive in the segment
    st.tasterT -= dt;
    if (st.tasterT <= 0 && !D.zones[D.seg].enemies.some((e) => e.dgTaster && e.alive)) {
      st.tasterT = cfg.tasterEvery;
      const e = H.spawnAt(D.zones[D.seg], 'lg_taster', deck.taster);
      e.dgTaster = true;
      ui.feed('A Royal Taster on the deck: its chalice gives Favor', '#ffc247');
    }
  });
  for (const e of D.zones[D.seg].enemies) if (e.dgTaster && !e.alive && !e.cupDone) { e.cupDone = true; H.dropChalice(D, S, e.pos.clone()); }
  // Watchers: a sweeping cone; seen long enough (or hurt and left alive) raises the deck's alarm
  const W = cfg.watch;
  for (const deck of seg.decks) {
    const st = S.decks[deck.id];
    if (!st.watchers.length) continue;
    for (const e of st.watchers) {
      const w = e.dgWatch;
      if (!e.alive || w.alarmed) continue;
      w.losT -= dt;
      if (w.losT <= 0) {
        w.losT = 0.15; w.seen = false; w.dist = 99;
        _a.set(e.pos.x, e.pos.y + W.fly + 0.6, e.pos.z); // the lens
        for (const p of players) {
          if (p.status?.has?.('invisible') || p.inv) continue;
          if (!inCone(e.pos.x, e.pos.z, e.yaw, p.pos.x, p.pos.z, W.range, W.half)) continue;
          _b.set(p.pos.x, p.pos.y + 1.5, p.pos.z);
          if (hasLOS(_a, _b)) { w.seen = true; w.dist = Math.min(w.dist, Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z)); }
        }
      }
      w.aware = awareStep(w.aware, dt, w.seen, w.dist, W);
      if (e.hp < e.maxHp) w.hurtFor += dt;
      if (w.aware >= 1) alarmDeck(D, S, seg, cfg, deck.id, 'seen');
      else if (hurtAlarm(w.hurtFor, e.alive, W.hurtAlarm)) alarmDeck(D, S, seg, cfg, deck.id, 'hurt');
    }
    if (!st.unseen && sectionOutcome(st.watchers.map((e) => ({ alive: e.alive, alarmed: e.dgWatch.alarmed }))) === 'unseen') {
      st.unseen = true;
      ui.feed('The Watchers fell unseen: no reinforcements', '#ffd24d');
      if (net.isHost) broadcast({ t: 'dfx', k: 'unseen', d: deck.id });
    }
  }
  // the exit: anyone through the north door crosses the segment
  if (players.some((p) => Math.hypot(p.pos.x - seg.exit.p[0], p.pos.z - seg.exit.p[2]) < seg.exit.r && p.pos.y > seg.exit.p[1] - 1.5)) {
    S.s = 'solved';
    H.segmentCleared(D, D.seg, seg);
  }
}
/** Host: a lever pull. */
function judgeLever(D, S, seg, i, who) {
  if (S.levers.solved) return;
  const sg = seg.levers[i].sigil, r = pullLever(S.levers, sg);
  if (r === 'ignored') return;
  leverResult(D, S, seg, i, r);
  if (net.isHost) broadcast({ t: 'dfx', k: 'lev', i, r });
  if (r === 'wrong') H.spawnKit(D.zones[D.seg], D.def.segments.underbelly.wrongWave, seg.decks[2].spawns);
  if (r === 'solved') openSecret(D, S, seg);
}
function leverResult(D, S, seg, i, r) {
  leverFx(S.mech, i, r === 'wrong' ? 'bad' : 'ok');
  if (r === 'wrong') ui.feed('Wrong lever: the mechanism resets', '#ff7a6b');
  if (r === 'right') ui.feed(`The ${SIGIL_NAMES[seg.levers[i].sigil]} lever holds`, '#ffd24d');
}
function openSecret(D, S, seg) {
  S.secretOpen = true;
  setDoor(S.mech.hatch, true);
  H.placeSecret(D, D.segs.indexOf(S), seg.secretChest);
  banner('A Hidden Hatch Opens', 'Something of the Emperor\'s was kept back here', 2.6, 'areaClear');
}

/** Everyone, per frame: grates, pistons, vents, levers, Watcher cones, chalice pickup. Returns the prompt text for the local player (or null). */
function underbellyLocal(D, S, seg, P, dt) {
  const cfg = D.def.segments.underbelly, M = G.mission;
  const blast = updateUnderbellyMech(S.mech, dt, P.dead ? 0 : P.status.remaining('favor'), D.clock, P);
  if (blast && !P.dead) { // a furnace vent: a capped burn and a throw east, off the walkway
    const inc = M.incomingMult || 1, pool = P.maxHealth + P.maxShield;
    damagePlayer(cappedHit(pool, pool, cfg.vent.hitFrac) / inc, P.pos.clone(), 'burn');
    P.vel.x = blast.spec.dir[0] * blast.spec.push; P.vel.z = blast.spec.dir[1] * blast.spec.push; P.vel.y = cfg.vent.up; P.onGround = false;
    sparks(P.pos.clone().setY(P.pos.y + 1), 0xff7a2a, 20, 6, 0.1, 0.5);
  }
  for (const e of G.enemies) if (e.typeId === 'lg_watcher' && e.alive) { dressWatcher(e, cfg.watch.range, cfg.watch.half); const w = e.dgWatch; tintWatcher(e, w?.aware ?? 0, w ? w.alarmed : !!e._alarmed); }
  if (S.s !== 'active' || P.dead) return null;
  const L = leverAt(S.mech, P.pos);
  if (L < 0 || S.levers.solved) return null;
  if (G.input.pressed.KeyE && G.time - (D.levT ?? -9) > 0.6) { D.levT = G.time; if (M.remote) send({ t: 'dh', k: 'lev', i: L }); else judgeLever(D, S, seg, L, H.localId()); }
  return `[E]  Pull the ${SIGIL_NAMES[seg.levers[L].sigil]} lever`;
}

// ---------------------------------------------------------------------------
// The Pleasure Gardens
// ---------------------------------------------------------------------------
function startGardens(D, i) {
  const seg = D.layout.segments[i], cfg = D.def.segments.gardens, S = D.segs[i], zone = D.zones[i], P0 = G.player;
  banner(seg.name, 'The Royal Beasts hunt by sight. Favor lets you light the flowers', 3.4, 'areaClear');
  // Kathrax: immune until the round's flowers are lit; ranged, capped, leashed to his pavilion outside the window
  const B = cfg.boss;
  const b = spawnUnit(zone, 'boss', new THREE.Vector3(...seg.boss), { name: B.name, element: B.element, model: B.model, faction: 'legion' });
  b.thresholds = []; b.maxShield = 1; b.shield = 0; if (b.model.shield) b.model.shield.visible = false;
  b.dgBoss = true; b.dgImm = true;
  b.scale = B.scale; b.radius = B.radius; b.height = b.model.height * b.scale;
  b.pos.y = seg.boss[1];
  const pool = P0.maxHealth + P0.maxShield, inc = G.mission.incomingMult || 1;
  b.def = { ...b.def, closeMelee: false, melee: false, splash: 0, burst: 3, burstGap: 0.35, fireCd: [2.2, 3.0], speed: B.speed, range: 60, prefer: 14, dmg: cappedHit(B.shotDmg * b.dmgMult * inc, pool, B.hitFrac.shot) / (b.dmgMult * inc) };
  b.stompT = B.stompEvery; b.stompWind = 0;
  b.bossUpdate = (dt) => kathraxStomp(D, S, b, B, dt);
  const home = seg.boss, upd = b.update.bind(b);
  b.update = (dt) => {
    const out = upd(dt);
    if (!b.alive) return out;
    const win = S.fsm?.mode === 'window';
    const [x, z] = leashStep(b.pos.x, b.pos.z, home, win ? B.windowLeash : B.leash, false, B.returnSpeed + B.speed, dt);
    if (x !== b.pos.x || z !== b.pos.z) { b.pos.x = x; b.pos.z = z; b.model.group.position.x = x; b.model.group.position.z = z; }
    // outside a window he only guards his pavilion: no shots at anyone farther than `guard`
    if (!win && !H.alivePlayers().some((p) => Math.hypot(p.pos.x - home[0], p.pos.z - home[2]) < B.guard)) { b.fireT = Math.max(b.fireT, 0.4); b.burstLeft = 0; }
    return out;
  };
  S.boss = b;
  S.fsm = new DpsBossFsm(cfg);
  // the Royal Beasts: immune hounds walked along their loops by the shared beast clock
  S.beasts = seg.beasts.map((bs, k) => {
    const st = beastAt(bs.path, cfg.beast.speed, cfg.beast.pause, cfg.beast.look, bs.phase * beastLoop(bs.path, cfg.beast.speed, cfg.beast.pause));
    const e = spawnUnit(zone, 'lg_royalbeast', new THREE.Vector3(st.x, seg.flowers[0][1], st.z), { faction: 'legion', noDrops: true });
    e.dgBoss = true; e.dgImm = true; e.dgBeast = k; e.fireT = 1e9;
    e.update = (dt) => beastStep(D, S, seg, cfg, e, k, dt);
    return e;
  });
  newFlowerRound(D, S, seg, cfg);
}
/** A beast's frame: walk its loop (sit still in a DPS window), swing the legs, face where it looks. */
function beastStep(D, S, seg, cfg, e, k, dt) {
  const m = e.model;
  if (!e.alive) { e.remove(); return false; }
  if (e.spawnT < 1) { e.spawnT = Math.min(1, e.spawnT + dt * 2.2); m.group.scale.setScalar(e.scale * Math.max(0.05, e.spawnT)); }
  const bs = seg.beasts[k], C = cfg.beast;
  const st = beastAt(bs.path, C.speed, C.pause, C.look, S.beastT + bs.phase * beastLoop(bs.path, C.speed, C.pause));
  const sit = S.fsm?.mode === 'window';
  if (!sit) { e.pos.x = st.x; e.pos.z = st.z; e.yaw = st.yaw; }
  e.pos.y = seg.flowers[0][1];
  m.group.position.copy(e.pos);
  m.group.rotation.y = e.yaw;
  const walk = !sit && st.moving, sw = walk ? Math.sin(G.time * 7.5) * 0.45 : 0;
  (m.legs || []).forEach((l, n) => { l.rotation.x = n % 3 === 0 ? sw : -sw; });
  if (m.head) m.head.rotation.x = sit ? 0.35 : 0;
  m.bodyMat?.emissive?.setRGB(0, 0, 0);
  return true;
}
function newFlowerRound(D, S, seg, cfg) {
  const n = flowerCount(cfg, G.mission.fireteam);
  S.flowers = pickFlowers(n, seg.flowers.length);
  S.mech.flowers.forEach((_, i) => setFlower(S.mech, i, S.flowers.includes(i) ? 'bud' : 'off'));
}
function kathraxStomp(D, S, b, B, dt) {
  if (b.stompWind > 0) {
    b.stompWind -= dt;
    if (b.stompWind <= 0) {
      ringFx(b.pos.clone().setY(b.pos.y + 0.2), B.stompRadius, 0xffffff, 0.6);
      flashLight(b.pos.clone().setY(b.pos.y + 1), 0x9fd0ff, 30, 18, 0.2);
      sfx.explosion(7, b.pos);
      for (const p of allPlayers()) {
        if (!p || p.dead || Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z) > B.stompRadius || p.pos.y > b.pos.y + 1.4) continue;
        H.bossHit(p, b, B.stompDmg, B.hitFrac.stomp, 'splash');
      }
    }
    return;
  }
  b.stompT -= dt;
  const near = allPlayers().some((p) => p && !p.dead && Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z) < B.stompRadius * 1.1);
  if (b.stompT <= 0 && near) { b.stompT = B.stompEvery; b.stompWind = 1.3; ringFx(b.pos.clone().setY(b.pos.y + 0.2), B.stompRadius, 0x6ab8ff, 1.3); }
}
/** Host: a Favored player lit flower i. */
function lightFlower(D, S, seg, cfg, i) {
  if (S.s !== 'active' || S.fsm?.mode !== 'immune' || S.howl || !S.flowers.includes(i) || S.mech.flowers[i].state !== 'bud') return;
  setFlower(S.mech, i, 'bloom');
  S.bloom++;
  if (net.isHost) broadcast({ t: 'dfx', k: 'flw', i });
  const lit = S.flowers.filter((j) => S.mech.flowers[j].state === 'bloom').length;
  ui.feed(`Bloom x${S.bloom}: ${lit} of ${S.flowers.length} flowers`, '#ffd24d');
  if (lit >= S.flowers.length) {
    S.fsm.openWindow();
    S.boss.dgImm = false;
    banner(`${cfg.boss.name.split(',')[0]} is exposed`, `Damage window: ${cfg.windowTime} seconds. The beasts are called to heel`, 2.4, 'alert');
    flashLight(S.boss.pos.clone().setY(S.boss.pos.y + 2), 0xffc247, 40, 30, 0.3);
    H.spawnKit(D.zones[D.seg], cfg.windowAdds, seg.spawns);
  }
}
function wipeAll(D, why) {
  if (net.isHost) broadcast({ t: 'dfx', k: 'maul', why });
  ui.centerMessage(why === 'down' ? 'Left Behind' : 'The Pack Feeds', why === 'down' ? 'A Guardian stayed down too long' : 'The Royal Beasts found you', 3);
  if (!G.player.dead) G.player.die('death');
}
function gardensTick(D, S, seg, cfg, dt) {
  const zone = D.zones[D.seg], b = S.boss, players = H.alivePlayers(), C = cfg.beast;
  if (S.fsm?.mode !== 'window') S.beastT += dt;
  // Royal Tasters in the corner alcoves
  S.tasterT = (S.tasterT ?? 2) - dt;
  if (S.tasterT <= 0 && !zone.enemies.some((e) => e.dgTaster && e.alive)) {
    S.tasterT = cfg.tasterEvery;
    const e = H.spawnAt(zone, 'lg_taster', seg.tasters[Math.floor(Math.random() * seg.tasters.length)]);
    e.dgTaster = true;
    ui.feed('A Royal Taster in the garden cloister', '#ffc247');
  }
  for (const e of zone.enemies) if (e.dgTaster && !e.alive && !e.cupDone) { e.cupDone = true; H.dropChalice(D, S, e.pos.clone()); }
  // beasts: sight, awareness, the howl and the wipe
  if (S.howl) {
    S.howl.t -= dt;
    if (S.howl.t <= 0) { S.howl = null; wipeAll(D, 'beast'); return; }
  } else if (S.fsm?.mode !== 'window') {
    S.beasts.forEach((e, k) => {
      let seen = false, dist = 99;
      _a.set(e.pos.x, e.pos.y + C.eye, e.pos.z);
      for (const p of players) {
        if (p.status?.has?.('invisible') || p.inv) continue;
        if (!inCone(e.pos.x, e.pos.z, e.yaw, p.pos.x, p.pos.z, C.range, C.half)) continue;
        _b.set(p.pos.x, p.pos.y + 1.5, p.pos.z);
        if (hasLOS(_a, _b)) { seen = true; dist = Math.min(dist, Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z)); }
      }
      S.aware[k] = awareStep(S.aware[k], dt, seen, dist, C);
      if (S.aware[k] >= 1 && !S.howl) {
        S.howl = { t: C.howl, k };
        howlFx(S, k, C.howl);
        if (net.isHost) broadcast({ t: 'dfx', k: 'howl', b: k, s: C.howl });
      }
    });
  } else S.aware = S.aware.map(() => 0);
  // fireteam: a Guardian down too long wipes the team
  if (G.mission.coop && allPlayers().length > 1) {
    const dead = Object.fromEntries(allPlayers().map((p) => [keyOf(p), !!p.dead]));
    const over = downStep(S.downs, dead, dt, cfg.downLimit);
    const worst = Math.max(0, ...Object.values(S.downs));
    S.downLeft = Object.keys(S.downs).length && !Object.values(dead).every(Boolean) ? Math.max(0, cfg.downLimit - worst) : null;
    if (over !== null && !Object.values(dead).every(Boolean)) { S.downs = {}; S.downLeft = null; wipeAll(D, 'down'); return; }
  }
  // the boss
  if (!b) return;
  if (!b.alive) { if (!S.bossDone) gardensCleared(D, S, seg); return; }
  const ev = S.fsm.tick(dt, b.hp, b.maxHp);
  b.dgImm = S.fsm.immune;
  if (ev.includes('window-end')) {
    S.bloom = 0;
    banner(`${cfg.boss.name.split(',')[0]} recovers`, 'The beasts are loose again. Light the new flowers', 2.6, 'alert');
    newFlowerRound(D, S, seg, cfg);
  }
}
function howlFx(S, k, secs) {
  const e = S.beasts?.[k] || G.enemies.filter((x) => x.typeId === 'lg_royalbeast')[k];
  sfx.beastHowl?.(e ? e.pos.clone() : undefined);
  banner('A Royal Beast Howls', `The pack has your scent. The fireteam falls in ${secs} seconds`, 3, 'alert');
  if (e) ringFx(e.pos.clone().setY(e.pos.y + 0.3), 12, 0xff3a2a, 1.2);
  S.howlEnd = G.time + secs;
}
function gardensCleared(D, S, seg) {
  S.bossDone = true; S.s = 'solved';
  for (const e of S.beasts) if (e.alive) { e.alive = false; e.hp = 0; e.dieT = 99; e.noBlast = true; e.model.group.visible = false; }
  H.removeLeftovers();
  S.mech.chalices.slice().forEach((c) => removeChalice(S.mech, c.id));
  S.mech.flowers.forEach((_, i) => setFlower(S.mech, i, 'off'));
  S.bloom = 0;
  H.reviveAll();
  H.segmentCleared(D, D.seg, seg);
}

/** Everyone, per frame: the prism, flowers, the channel, Bloom on the local player, the beasts' eyes. */
function gardensLocal(D, S, seg, P, dt) {
  const cfg = D.def.segments.gardens, fav = !P.dead && P.status.has('favor');
  updateGardensMech(S.mech, dt, fav && S.s === 'active', D.clock);
  // Bloom: every machine carries the team's stacks as its own status (weapon damage, dungeon-perks.js imperialDmg)
  const want = S.s === 'active' ? S.bloom : 0;
  if (want > 0) { if (P.status.stacks('bloom') !== want) P.status.apply('bloom', { stacks: want, t: Infinity, set: true }); }
  else if (P.status.has('bloom')) P.status.remove('bloom');
  // beast eyes: over each beast's head (members take the positions from the snapshot)
  const bp = S.beastPos || S.beasts.map((e) => [e.pos.x, e.pos.z]);
  bp.forEach(([x, z], k) => beastEye(S.mech, k, _a.set(x, seg.flowers[0][1] + 3.2, z), S.aware[k] ?? 0, !!(S.howl && S.howl.k === k) || (S.howlK === k && G.time < (S.howlEnd ?? 0))));
  for (const e of G.enemies) if (e.typeId === 'lg_royalbeast' && e.model.visor) e.model.visor.emissive?.setRGB(1, 0.2 + 0.6 * (1 - (S.aware[e.dgBeast ?? 0] ?? 0)), 0.1);
  if (S.s !== 'active' || P.dead || !fav || S.fsm?.mode === 'window') { if (S.chan.i >= 0) { S.chan = { i: -1, t: 0 }; setChannel(S.mech, -1, 0); } return null; }
  const i = budAt(S.mech, P.pos, cfg.lightR);
  if (i !== S.chan.i) S.chan = { i, t: 0 };
  if (i < 0) { setChannel(S.mech, -1, 0); return null; }
  S.chan.t += dt;
  setChannel(S.mech, i, Math.min(1, S.chan.t / cfg.channel));
  if (S.chan.t >= cfg.channel) {
    S.chan = { i: -1, t: -0.5 }; setChannel(S.mech, -1, 0);
    if (G.mission.remote) send({ t: 'dh', k: 'flw', i }); else lightFlower(D, S, seg, cfg, i);
  }
  return 'The prism lights the flower: hold still';
}

// ---------------------------------------------------------------------------
// Hooks for dungeon.js
// ---------------------------------------------------------------------------
/** Everyone, per frame, for every chunk B segment's objects; returns the local prompt (or null). */
export function localB(D, i, P, dt) {
  const seg = D.layout.segments[i], S = D.segs[i];
  if (seg.id === 'underbelly') return underbellyLocal(D, S, seg, P, dt);
  if (seg.id === 'gardens') return gardensLocal(D, S, seg, P, dt);
  return null;
}
/** Host or solo, per frame, for the current segment. */
export function tickB(D, S, seg, dt) {
  if (seg.id === 'underbelly') underbellyTick(D, S, seg, D.def.segments.underbelly, dt);
  if (seg.id === 'gardens') gardensTick(D, S, seg, D.def.segments.gardens, dt);
}
/** True when the pending segment should start: someone is in its region. */
export const shouldActivate = (seg, players) => players.some((p) => inRegion(p.pos, seg.region));

export function objectiveB(D, S, seg) {
  const M = G.mission, fav = G.player.status.has('favor'), wp = (p) => { M.waypoint = p ? new THREE.Vector3(...p) : null; };
  if (seg.id === 'underbelly') {
    if (S.s === 'solved') { wp(null); return 'Press on'; }
    wp(seg.exit.p);
    const alarm = Object.values(S.decks || {}).some((d) => d.alarm && d.watchers.some((e) => e.alive));
    return `Cross ${seg.name}${fav ? '' : '  ·  Take a chalice: the grates need Favor'}${alarm ? '  ·  Reinforcements' : ''}`;
  }
  if (seg.id === 'gardens') {
    wp(null);
    if (S.howlEnd && G.time < S.howlEnd) return `The pack is coming  ·  ${Math.ceil(S.howlEnd - G.time)}s`;
    if (S.downLeft != null) return `Revive your teammate  ·  ${Math.ceil(S.downLeft)}s`;
    const f = S.fsm;
    if (f?.mode === 'window') return `Damage Kathrax  ·  Bloom x${S.bloom}  ·  ${Math.ceil(f.windowLeft)}s`;
    const lit = (S.flowers || []).filter((j) => S.mech.flowers[j].state === 'bloom').length;
    if (!fav) return `Stay out of the beasts' sight. Take a chalice for the prism  ·  ${lit}/${(S.flowers || []).length} flowers`;
    return `Light the flowers with the prism  ·  ${lit}/${(S.flowers || []).length}  ·  Bloom x${S.bloom}`;
  }
  return seg.name;
}

// ---------- co-op ----------
export function snapB(D, S, seg) {
  if (seg.id === 'underbelly') return { lo: S.levers.order, lp: S.levers.progress, ls: S.levers.solved ? 1 : 0, al: Object.entries(S.decks).filter(([, d]) => d.alarm).map(([k]) => k), so: S.secretOpen ? 1 : 0 };
  if (seg.id === 'gardens') {
    return {
      fl: S.mech.flowers.map((F) => ['off', 'bud', 'bloom'].indexOf(F.state)), bl: S.bloom, aw: S.aware.map((a) => Math.round(a * 20) / 20),
      bp: S.beasts.map((e) => [Math.round(e.pos.x * 10) / 10, Math.round(e.pos.z * 10) / 10]), hw: S.howl ? Math.round(S.howl.t * 10) / 10 : -1, hk: S.howl ? S.howl.k : -1,
      dn: S.downLeft == null ? -1 : Math.round(S.downLeft), fs: S.fsm ? { m: S.fsm.mode, wl: Math.round(S.fsm.windowLeft * 10) / 10 } : 0,
    };
  }
  return {};
}
export function onSnapB(D, S, seg, m) {
  if (seg.id === 'underbelly' && m.lo) {
    if (S.levers.order.join() !== m.lo.join()) { S.levers.order = m.lo.slice(); setPlaque(S.mech, S.levers.order); }
    S.levers.progress = m.lp; S.levers.solved = !!m.ls;
    for (const [k, d] of Object.entries(S.decks)) d.alarm = m.al.includes(k);
    for (const e of G.enemies) if (e.typeId === 'lg_watcher') e._alarmed = m.al.some((k) => near(e, seg.watchers[k]));
    if (m.so && !S.secretOpen) { S.secretOpen = true; setDoor(S.mech.hatch, true); H.placeSecret(D, D.segs.indexOf(S), seg.secretChest); }
  }
  if (seg.id === 'gardens' && m.fl) {
    m.fl.forEach((c, i) => setFlower(S.mech, i, ['off', 'bud', 'bloom'][c] ?? 'off'));
    S.bloom = m.bl; S.aware = m.aw; S.beastPos = m.bp;
    S.howl = m.hw >= 0 ? { t: m.hw, k: m.hk } : null;
    S.downLeft = m.dn >= 0 ? m.dn : null;
    S.fsm = m.fs ? { mode: m.fs.m, windowLeft: m.fs.wl } : null;
  }
}
const near = (e, list) => (list || []).some((w) => Math.hypot(e.pos.x - w.p[0], e.pos.z - w.p[2]) < 2);
/** Host: a member's lever pull or flower light. Returns true when handled. */
export function onHostMsgB(D, m, from) {
  const S = D.segs[D.seg], seg = D.layout.segments[D.seg];
  if (m.k === 'lev' && seg.id === 'underbelly') { judgeLever(D, S, seg, m.i, from); return true; }
  if (m.k === 'flw' && seg.id === 'gardens') { lightFlower(D, S, seg, D.def.segments.gardens, m.i); return true; }
  return false;
}
/** Member: an effect from the host. Returns true when handled. */
export function onFxB(D, m) {
  const find = (id) => D.layout.segments.findIndex((s) => s.id === id);
  if (m.k === 'lev') { const i = find('underbelly'); leverResult(D, D.segs[i], D.layout.segments[i], m.i, m.r); return true; }
  if (m.k === 'alarm') { sfx.watcherAlarm?.(); banner('Seen', 'A Watcher has called reinforcements', 2.2, 'alert'); return true; }
  if (m.k === 'unseen') { ui.feed('The Watchers fell unseen: no reinforcements', '#ffd24d'); return true; }
  if (m.k === 'flw') { const i = find('gardens'); setFlower(D.segs[i].mech, m.i, 'bloom'); return true; }
  if (m.k === 'howl') { const S = D.segs[find('gardens')]; S.howlK = m.b; howlFx(S, m.b, m.s); return true; }
  if (m.k === 'maul') { ui.centerMessage(m.why === 'down' ? 'Left Behind' : 'The Pack Feeds', m.why === 'down' ? 'A Guardian stayed down too long' : 'The Royal Beasts found you', 3); if (!G.player.dead) G.player.die('death'); return true; }
  return false;
}
/** Host: a damage multiplier hook is not needed (Bloom is a status); exported for the dev console. */
export function devB(D) {
  const S = D.segs[D.seg], seg = D.layout.segments[D.seg];
  return {
    bloomAll: () => { if (seg.id !== 'gardens') return 'Not in the Gardens'; for (const i of S.flowers) lightFlower(D, S, seg, D.def.segments.gardens, i); return `Bloom x${S.bloom}`; },
    levers: () => (seg.id === 'underbelly' ? S.levers.order.join(' > ') : 'Not in the Underbelly'),
  };
}
