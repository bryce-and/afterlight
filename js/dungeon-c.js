// U23 chunk C: the runtime of The Gauntlet (traversal) and The Throne (the final boss, Emperor Calus). js/dungeon.js owns the shell and
// calls in here per segment, as it does for js/dungeon-b.js; the helpers it shares come in through bindC().
// Host or solo decide (offerings at the shield walls, landings, the Throne's rounds, Calus, the DPS machine with enrage and final stand);
// members mirror the 'ds' snapshot fields this file adds (snapC / onSnapC) and send their offerings and lantern shots as 'dh'.
// Each player's own machine runs their Gaze and Mindscape (like Favor): the Gaze is driven by the shared clock D.clock.
import * as THREE from 'three';
import { G } from './state.js';
import * as ui from './ui.js';
import { sfx } from './audio.js';
import { net, send, broadcast, sendTo } from './net.js';
import { ringFx, flashLight, sparks } from './effects.js';
import { hasLOS } from './physics.js';
import { allPlayers } from './coop.js';
import { spawnUnit, damagePlayer, banner } from './game.js';
import { stinger } from './music.js';
import {
  buildGauntletMech, updateGauntletMech, setRowSigil, setWall, flashGPlate, setGStrike, gPlateAt, openSecretDoor,
  buildThroneMech, updateThroneMech, setLanternSigils, setMindView, drawMind, flashLantern, disposeMechC,
} from './dungeon-mech-c.js';
import { removeChalice } from './dungeon-mech.js';
import {
  SIGILS, SIGIL_NAMES, newRound, offer, shuffled, offeringSteps, watchYaw, inCone, awareStep, DpsBossFsm, cappedHit, leashStep,
  bossHpFor, guardFor, feastStage, flawlessProcession,
} from './dungeon-rules.js';

let H = null; // helpers from dungeon.js
export function bindC(h) { H = h; }
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const onLand = (L, p) => p.x >= L.x0 - 0.5 && p.x <= L.x1 + 0.5 && p.z <= L.z0 + 0.5 && p.z >= L.z1 - 0.5 && Math.abs(p.y - L.top) < 1.6;
export const ownsC = (seg) => seg.id === 'gauntlet' || seg.id === 'throne';

// ---------------------------------------------------------------------------
// Segment state
// ---------------------------------------------------------------------------
/** Builds the segment's objects and state (everyone). Returns true when this file owns the segment. */
export function initSegC(S, seg) {
  if (seg.id === 'gauntlet') {
    S.mech = buildGauntletMech(seg);
    S.rowsSt = seg.rows.map((R) => ({ round: newRound(1), strikes: {}, open: false, spawned: false, tasterT: 0 }));
    S.rowsSt.forEach((st, r) => setRowSigil(S.mech, r, st.round.order[0]));
    Object.assign(S, { wrongs: 0, reached: -1, secretOpen: false });
    return true;
  }
  if (seg.id === 'throne') {
    S.mech = buildThroneMech(seg);
    S.mech.onLanternShot = (i) => lanternShot(i);
    Object.assign(S, { round: null, roundNo: 0, strikes: {}, waveIdx: 0, tasterT: 3, aware: 0, gazeBurnT: 0, mindBurnT: 0, lanT: 0, enraged: false, feastDone: false });
    setLanternSigils(S.mech, SIGILS);
    return true;
  }
  return false;
}
export const disposeSegC = (S) => disposeMechC(S.mech);

/** Host or solo: back to how the segment was entered. The Gauntlet keeps its open walls (you respawn on the landing you reached). */
export function resetSegC(D, S, seg) {
  for (const c of S.mech.chalices.slice()) removeChalice(S.mech, c.id);
  if (seg.id === 'gauntlet') {
    S.rowsSt.forEach((st, r) => { st.spawned = false; st.tasterT = 0; if (!st.open) st.strikes = {}; });
    S.mech.rows.forEach((R, r) => R.plates.forEach((_, i) => setGStrike(S.mech, r, i, 0, D.def.strikes)));
    S.s = 'active';
  }
  if (seg.id === 'throne') {
    Object.assign(S, { round: null, roundNo: 0, strikes: {}, waveIdx: 0, tasterT: 3, lanT: 0, enraged: false, feastDone: false, fsm: null, boss: null, s: 'pending' });
    setLanternSigils(S.mech, SIGILS);
    drawMind(S.mech, null);
    G.player?.status.remove('mindscape');
  }
}
/** Member: the host reset the encounter. */
export function onResetC(S, seg) {
  if (seg.id === 'throne') { G.player?.status.remove('mindscape'); S.aware = 0; }
  if (seg.id === 'gauntlet') S.mech.rows.forEach((R, r) => R.plates.forEach((_, i) => setGStrike(S.mech, r, i, 0, 3)));
}

export function activateC(D, i) {
  const seg = D.layout.segments[i], S = D.segs[i];
  S.s = 'active';
  if (seg.id === 'gauntlet') banner(seg.name, 'Read the herald under Favor and offer its sigil. The stair holds only for the Favored', 3.4, 'areaClear');
  if (seg.id === 'throne') startThrone(D, i);
}

// ---------------------------------------------------------------------------
// The Gauntlet
// ---------------------------------------------------------------------------
function gauntletTick(D, S, seg, cfg, dt) {
  const players = H.alivePlayers(), zone = D.zones[D.seg];
  seg.rows.forEach((R, r) => {
    const st = S.rowsSt[r], L = seg.landings.find((x) => x.id === R.land);
    if (!players.some((p) => onLand(L, p.pos))) return;
    if (!st.spawned) {
      st.spawned = true;
      H.spawnKit(zone, cfg.rows[r], R.spawns);
      for (const t of H.expand(cfg.snipers)) { const e = H.spawnAt(zone, t, R.perch); e.dgPerch = true; }
    }
    if (r > S.reached) { S.reached = r; G.mission.checkpoint.set(...R.checkpoint); if (r > 0) ui.feed('Checkpoint', '#ffd24d'); }
    st.tasterT -= dt;
    if (st.tasterT <= 0 && !zone.enemies.some((e) => e.dgTaster && e.alive)) {
      st.tasterT = cfg.tasterEvery;
      const e = H.spawnAt(zone, 'lg_taster', R.taster);
      e.dgTaster = true;
      ui.feed('A Royal Taster carries Favor onto the landing', '#ffc247');
    }
  });
  for (const e of zone.enemies) if (e.dgTaster && !e.alive && !e.cupDone) { e.cupDone = true; H.dropChalice(D, S, e.pos.clone()); }
  // the last landing crosses the Gauntlet; a flawless procession opens the alcove
  if (players.some((p) => Math.hypot(p.pos.x - seg.exit.p[0], p.pos.z - seg.exit.p[2]) < seg.exit.r && p.pos.y > seg.exit.p[1] - 1.5)) {
    S.s = 'solved';
    if (flawlessProcession(S.wrongs, S.rowsSt.filter((x) => x.open).length, seg.rows.length)) openGSecret(D, S, seg);
    H.segmentCleared(D, D.seg, seg);
  }
}
function openGSecret(D, S, seg) {
  if (S.secretOpen) return;
  S.secretOpen = true;
  openSecretDoor(S.mech);
  H.placeSecret(D, D.segs.indexOf(S), seg.secretChest);
  banner('A Flawless Procession', 'The Emperor is pleased. A hidden alcove opens beside you', 3, 'areaClear');
}
/** Host or solo: a Favored player offers at plate i of row r. */
function judgeGOffer(D, S, seg, r, i, who) {
  const st = S.rowsSt[r];
  if (!st || st.open || S.s !== 'active') return;
  const sigil = seg.rows[r].wall.plates[i].sigil;
  const res = offer(st.round, st.strikes, who, sigil, D.def.strikes);
  if (res === 'ignored') return;
  const n = st.strikes[who] || 0;
  gOfferFx(D, S, r, i, res, who === H.localId() ? n : -1);
  if (net.isHost) broadcast({ t: 'dfx', k: 'gof', r, i, res, who, n });
  if (res === 'wrong' || res === 'lethal') { S.wrongs++; H.spawnKit(D.zones[D.seg], D.def.segments.gauntlet.wrongWave, seg.rows[r].spawns); }
  if (res === 'lethal') { if (who === H.localId()) G.player.die('death'); else sendTo(who, { t: 'dfx', k: 'lethal' }); }
  if (res === 'solved') { st.open = true; setWall(S.mech, r, true); banner('The Shield Falls', 'The stair holds only for the Favored. Mind the wards', 2.4, 'alert'); }
}
function gOfferFx(D, S, r, i, res, mine) {
  const ok = res === 'right' || res === 'solved';
  flashGPlate(S.mech, r, i, ok ? 'ok' : 'bad');
  if (mine < 0) { if (res === 'solved') setWall(S.mech, r, true); return; }
  setGStrike(S.mech, r, i, ok || res === 'lethal' ? 0 : mine, D.def.strikes);
  if (!ok) ui.feed(res === 'lethal' ? 'The Emperor does not forgive a third insult' : `Wrong offering: ${mine} of ${D.def.strikes}. The third is lethal`, '#ff7a6b');
}
function gauntletLocal(D, S, seg, P, dt) {
  const fav = !P.dead && P.status.has('favor');
  updateGauntletMech(S.mech, dt, P.dead ? 0 : P.status.remaining('favor'), D.clock, P);
  if (S.s !== 'active' || P.dead) return null;
  const at = gPlateAt(S.mech, P.pos);
  if (!at) return null;
  if (!fav) return 'Favor is needed to read the herald';
  if (G.input.pressed.KeyE && G.time - (D.gofT ?? -9) > 0.5) {
    D.gofT = G.time;
    if (G.mission.remote) send({ t: 'dh', k: 'gof', r: at.r, i: at.i }); else judgeGOffer(D, S, seg, at.r, at.i, H.localId());
  }
  return `[E]  Offer the ${SIGIL_NAMES[seg.rows[at.r].wall.plates[at.i].sigil]}`;
}

// ---------------------------------------------------------------------------
// The Throne
// ---------------------------------------------------------------------------
const DAIS_Y = (seg) => seg.dais.p[1];
function startThrone(D, i) {
  const seg = D.layout.segments[i], cfg = D.def.segments.throne, S = D.segs[i], zone = D.zones[i], P0 = G.player, B = cfg.boss;
  banner(seg.name, 'Calus\'s Gaze draws the Favored into his Mindscape. Shoot his thoughts in order', 3.6, 'areaClear');
  const b = spawnUnit(zone, 'boss', new THREE.Vector3(...seg.seat), { name: B.name, element: B.element, model: B.model, faction: 'legion' });
  b.thresholds = []; b.maxShield = 1; b.shield = 0; if (b.model.shield) b.model.shield.visible = false;
  b.dgBoss = true; b.dgImm = true;
  b.scale = B.scale; b.radius = B.radius; b.height = b.model.height * b.scale;
  b.maxHp = b.hp = bossHpFor(b.maxHp, B, guardFor(D.def, G.mission.fireteam));
  b.pos.y = seg.seat[1];
  const pool = P0.maxHealth + P0.maxShield, inc = G.mission.incomingMult || 1;
  b.def = { ...b.def, closeMelee: false, melee: false, splash: 1.2, burst: 3, burstGap: 0.4, fireCd: [2.4, 3.2], speed: B.speed, range: 70, prefer: 30, projSpeed: 22, shotSize: 0.4, dmg: cappedHit(B.shotDmg * b.dmgMult * inc, pool, B.hitFrac.orb) / (b.dmgMult * inc) };
  b.baseShot = b.def.dmg;
  b.shotColor = 0xb06cff;
  b.slamT = B.slamEvery; b.slamWind = 0;
  b.bossUpdate = (dt) => calusSlam(D, S, b, B, dt);
  const upd = b.update.bind(b);
  b.update = (dt) => {
    const out = upd(dt);
    if (!b.alive) return out;
    const onDais = S.fsm && (S.fsm.mode === 'window' || S.fsm.mode === 'final');
    const home = onDais ? seg.dais.p : seg.seat;
    const [x, z] = leashStep(b.pos.x, b.pos.z, home, onDais ? B.windowLeash : B.leash, false, B.returnSpeed + B.speed, dt);
    if (x !== b.pos.x || z !== b.pos.z) { b.pos.x = x; b.pos.z = z; b.model.group.position.x = x; b.model.group.position.z = z; }
    // The Emperor's Feast: he rises and lifts the goblet over the wind-up
    const fk = S.fsm?.mode === 'final' ? feastStage(S.fsm.finalLeft, cfg.enrage.finalWind).k : 0;
    if (b.model.gobletArm) b.model.gobletArm.rotation.x = -fk * 1.6;
    b.model.group.position.y = b.pos.y + fk * 1.8;
    if (fk > 0) { b.fireT = Math.max(b.fireT, 0.5); b.burstLeft = 0; } // no shots while he feasts: all eyes on the goblet
    return out;
  };
  S.boss = b;
  S.fsm = new DpsBossFsm(cfg);
  newMindRound(D, S, cfg, false);
  H.spawnKit(zone, cfg.waves[0], seg.spawns);
  S.waveIdx = 1;
}
/** Moves Calus between his seat and the dais in a flash of psychic light. */
function calusTo(S, at) {
  const b = S.boss;
  if (!b?.alive) return;
  flashLight(b.pos.clone().setY(b.pos.y + 2), 0xb06cff, 40, 26, 0.3);
  sparks(b.pos.clone().setY(b.pos.y + 2), 0xb06cff, 30, 8, 0.12, 0.6);
  b.pos.set(at[0], at[1], at[2]);
  b.model.group.position.copy(b.pos);
  sparks(b.pos.clone().setY(b.pos.y + 2), 0xffc247, 30, 8, 0.12, 0.6);
}
function newMindRound(D, S, cfg, shuffle) {
  S.roundNo++;
  S.round = newRound(offeringSteps(cfg, G.mission.fireteam));
  S.strikes = {};
  if (shuffle) setLanternSigils(S.mech, shuffled(SIGILS));
  drawMind(S.mech, S.round);
}
function calusSlam(D, S, b, B, dt) {
  if (!S.fsm || (S.fsm.mode !== 'window')) { b.slamWind = 0; return; }
  if (b.slamWind > 0) {
    b.slamWind -= dt;
    if (b.slamWind <= 0) {
      ringFx(b.pos.clone().setY(b.pos.y + 0.2), B.slamRadius, 0xffffff, 0.6);
      flashLight(b.pos.clone().setY(b.pos.y + 1), 0xb06cff, 36, 20, 0.2);
      sfx.explosion(8, b.pos);
      for (const p of allPlayers()) {
        if (!p || p.dead || Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z) > B.slamRadius || p.pos.y > b.pos.y + 1.4) continue;
        H.bossHit(p, b, B.slamDmg * (S.enraged ? D.def.segments.throne.enragedMult : 1), B.hitFrac.slam, 'splash');
      }
    }
    return;
  }
  b.slamT -= dt;
  if (b.slamT <= 0) { b.slamT = B.slamEvery; b.slamWind = 1.5; ringFx(b.pos.clone().setY(b.pos.y + 0.2), B.slamRadius, 0xb06cff, 1.5); }
}
/** Everyone: a lantern was shot by the local player. */
function lanternShot(i) {
  const D = G.mission?.dungeon, S = D?.segs[D.seg], seg = D?.layout.segments[D.seg];
  if (!S || seg.id !== 'throne' || !G.player.status.has('mindscape')) return;
  if (G.time - (D.lanShotT ?? -9) < D.def.segments.throne.lanternCd) return;
  D.lanShotT = G.time;
  if (G.mission.remote) send({ t: 'dh', k: 'lan', i }); else judgeLantern(D, S, seg, i, H.localId());
}
function judgeLantern(D, S, seg, i, who) {
  const cfg = D.def.segments.throne;
  if (S.s !== 'active' || !S.round || S.round.solved || S.fsm?.mode !== 'immune') return;
  const res = offer(S.round, S.strikes, who, S.mech.sigils[i], D.def.strikes);
  if (res === 'ignored') return;
  const n = S.strikes[who] || 0;
  lanternFx(D, S, i, res, who === H.localId() ? n : -1);
  if (net.isHost) broadcast({ t: 'dfx', k: 'lan', i, res, who, n });
  if (res === 'wrong' || res === 'lethal') H.spawnKit(D.zones[D.seg], cfg.wrongWave, seg.spawns);
  if (res === 'lethal') { if (who === H.localId()) G.player.die('death'); else sendTo(who, { t: 'dfx', k: 'lethal' }); }
  if (res === 'solved') openThroneWindow(D, S, seg, cfg);
}
function lanternFx(D, S, i, res, mine) {
  const ok = res === 'right' || res === 'solved';
  flashLantern(S.mech, i, ok ? 'ok' : 'bad');
  if (ok) sfx.glyphRight(); else sfx.glyphWrong();
  S.mech.board.flash = ok ? 'ok' : 'bad'; S.mech.board.flashT = 0.7;
  if (S.round) drawMind(S.mech, S.round, S.mech.board.flash);
  if (mine >= 0 && !ok) ui.feed(res === 'lethal' ? 'Your mind breaks under the Emperor\'s' : `A false thought: ${mine} of ${D.def.strikes}. The third is lethal`, '#ff7a6b');
}
function openThroneWindow(D, S, seg, cfg) {
  const ev = S.fsm.openWindow();
  if (!ev.length) return;
  S.boss.dgImm = false;
  calusTo(S, seg.dais.p);
  endMind();
  const last = ev.includes('enrage-warning') || S.enraged;
  banner('Calus Descends', last ? (S.enraged ? 'This is the last audience. Finish him or face his Feast' : 'The Emperor grows impatient: one more audience after this') : `Damage window: ${cfg.windowTime} seconds. On the dais`, 2.8, 'alert');
  if (net.isHost) broadcast({ t: 'dfx', k: 'twin', w: last ? 1 : 0, en: S.enraged ? 1 : 0 });
  H.spawnKit(D.zones[D.seg], cfg.windowAdds, seg.spawns);
}
function endMind() {
  if (G.player.status.has('mindscape')) { G.player.status.remove('mindscape'); ui.feed('The Mindscape releases you', '#c78bff'); }
}
function throneTick(D, S, seg, cfg, dt) {
  const zone = D.zones[D.seg], b = S.boss;
  if (!b || !S.fsm) return;
  // adds while he sits; a Royal Taster when none is alive
  if (S.fsm.mode === 'immune') {
    if (S.waveIdx < cfg.waves.length && H.aliveIn(zone) <= 3) { H.spawnKit(zone, cfg.waves[S.waveIdx], seg.spawns); S.waveIdx++; }
    else if (S.waveIdx >= cfg.waves.length && H.aliveIn(zone) <= 2) S.waveIdx = 1;
  }
  S.tasterT -= dt;
  if (S.tasterT <= 0 && !zone.enemies.some((e) => e.dgTaster && e.alive)) {
    S.tasterT = cfg.tasterEvery;
    const e = H.spawnAt(zone, 'lg_taster', seg.tasters[Math.floor(Math.random() * seg.tasters.length)]);
    e.dgTaster = true;
    ui.feed('A Royal Taster brings the Emperor\'s wine', '#ffc247');
  }
  for (const e of zone.enemies) if (e.dgTaster && !e.alive && !e.cupDone) { e.cupDone = true; H.dropChalice(D, S, e.pos.clone()); }
  if (!b.alive) { if (!S.bossDone) throneCleared(D, S, seg); return; }
  if (S.feastDone) return;
  const ev = S.fsm.tick(dt, b.hp, b.maxHp);
  b.dgImm = S.fsm.immune;
  if (ev.includes('window-end')) {
    calusTo(S, seg.seat);
    banner('Calus Returns To His Throne', 'His thoughts have moved. Take Favor and meet his Gaze', 2.6, 'alert');
    newMindRound(D, S, cfg, true);
  }
  if (ev.includes('enraged')) {
    S.enraged = true;
    b.def = { ...b.def, dmg: b.baseShot * cfg.enragedMult, fireCd: [1.8, 2.4] };
    banner('The Emperor Is Enraged', 'One more audience. Then the Feast', 3, 'alert');
    H.spawnKit(zone, cfg.enragedAdds, seg.spawns);
    stinger('boss');
  }
  if (ev.includes('final')) {
    calusTo(S, seg.dais.p);
    S.boss.dgImm = false;
    endMind();
    banner("The Emperor's Feast", `He raises his goblet. Kill him before he drinks: ${cfg.enrage.finalWind} seconds`, 3.4, 'alert');
    if (net.isHost) broadcast({ t: 'dfx', k: 'feast' });
    stinger('boss');
  }
  if (ev.includes('final-wipe')) {
    S.feastDone = true;
    feastWipe();
    if (net.isHost) broadcast({ t: 'dfx', k: 'feastwipe' });
  }
}
function feastWipe() {
  ui.centerMessage("The Emperor's Feast", 'Calus drinks, and the fireteam is consumed', 3.4);
  sfx.explosion(10, G.player.pos);
  flashLight(G.player.pos.clone().setY(G.player.pos.y + 3), 0xffc247, 80, 40, 0.5);
  if (!G.player.dead) G.player.die('death');
}
function throneCleared(D, S, seg) {
  S.bossDone = true; S.s = 'solved';
  endMind();
  H.removeLeftovers();
  S.mech.chalices.slice().forEach((c) => removeChalice(S.mech, c.id));
  drawMind(S.mech, null);
  H.reviveAll();
  H.segmentCleared(D, D.seg, seg);
}
/** Everyone, per frame: the Gaze on the local player, the Mindscape, the lanterns and board, the Feast. Returns the local prompt (or null). */
function throneLocal(D, S, seg, P, dt) {
  const cfg = D.def.segments.throne, C = cfg.gaze, f = S.fsm, active = S.s === 'active' && !!f;
  const gazeOn = active && f.mode === 'immune' && !(S.round?.solved);
  const yaw = watchYaw({ ...seg.gaze, period: seg.gaze.period * (S.enraged ? 0.7 : 1) }, D.clock);
  const inMind = !P.dead && P.status.has('mindscape');
  if (gazeOn && !P.dead && !inMind) {
    D.gazeLosT = (D.gazeLosT ?? 0) - dt;
    if (D.gazeLosT <= 0) {
      D.gazeLosT = 0.12;
      _a.set(...seg.gaze.p); _b.set(P.pos.x, P.pos.y + 1.5, P.pos.z);
      D.gazeSeen = inCone(seg.gaze.p[0], seg.gaze.p[2], yaw, P.pos.x, P.pos.z, C.range, C.half) && hasLOS(_a, _b);
    }
    S.aware = awareStep(S.aware, dt, D.gazeSeen, 0, C);
    if (D.gazeSeen && !P.status.has('favor')) { // unFavored, the Gaze burns
      S.gazeBurnT -= dt;
      if (S.gazeBurnT <= 0) { S.gazeBurnT = 0.5; damagePlayer(C.burn * 0.5, P.pos.clone(), 'burn'); if (G.time - (D.gazeMsgT ?? -9) > 4) { D.gazeMsgT = G.time; ui.feed('The Emperor\'s Gaze burns those without his Favor', '#ff7a6b'); } }
    }
    if (S.aware >= 1 && P.status.has('favor')) {
      S.aware = 0;
      P.status.apply('mindscape', { t: cfg.mind.time, set: true });
      sfx.engram(3);
      banner('The Mindscape', 'Shoot the Emperor\'s thoughts in the order on his board', 2.4, 'alert');
    }
  } else S.aware = Math.max(0, S.aware - dt * C.decay);
  const mind = !P.dead && P.status.has('mindscape') && active && f.mode === 'immune';
  if (!mind && P.status.has('mindscape') && (!active || f.mode !== 'immune')) P.status.remove('mindscape');
  setMindView(S.mech, mind);
  D.fogOverride = mind ? { color: 0x4a1a78, near: 6, far: 70 } : null;
  if (mind) {
    S.mindBurnT -= dt;
    if (S.mindBurnT <= 0) { S.mindBurnT = 1; damagePlayer(cfg.mind.burn, P.pos.clone(), 'burn'); }
    if (S.round) drawMind(S.mech, S.round, S.mech.board.flashT > 0 ? S.mech.board.flash : null);
  }
  const feastK = f?.mode === 'final' ? feastStage(f.finalLeft, cfg.enrage.finalWind).k : null;
  const b = S.boss || G.enemies.find((e) => e.isBoss && e.alive);
  updateThroneMech(S.mech, dt, D.clock, yaw, S.aware, gazeOn, feastK, b ? b.pos : _a.set(...seg.dais.p));
  if (feastK != null && Math.floor(f.finalLeft) !== D.feastSec) { D.feastSec = Math.floor(f.finalLeft); if (D.feastSec <= 5) sfx.glyphWrong(); }
  return null;
}

// ---------------------------------------------------------------------------
// Hooks for dungeon.js
// ---------------------------------------------------------------------------
export function localC(D, i, P, dt) {
  const seg = D.layout.segments[i], S = D.segs[i];
  if (seg.id === 'gauntlet') return gauntletLocal(D, S, seg, P, dt);
  if (seg.id === 'throne') return throneLocal(D, S, seg, P, dt);
  return null;
}
export function tickC(D, S, seg, dt) {
  if (seg.id === 'gauntlet') gauntletTick(D, S, seg, D.def.segments.gauntlet, dt);
  if (seg.id === 'throne') throneTick(D, S, seg, D.def.segments.throne, dt);
}
export function objectiveC(D, S, seg) {
  const M = G.mission, fav = G.player.status.has('favor'), wp = (p) => { M.waypoint = p ? new THREE.Vector3(...p) : null; };
  if (seg.id === 'gauntlet') {
    if (S.s === 'solved') { wp(null); return 'Press on'; }
    const r = S.rowsSt.findIndex((x) => !x.open);
    if (r < 0) { wp(seg.exit.p); return `Climb to the Throne${fav ? '' : '  ·  Take a chalice: the stair needs Favor'}`; }
    wp(null);
    return fav ? `Offer the herald's sigil at the shield wall  ·  ${r + 1} of ${seg.rows.length}` : `Take a chalice from a Royal Taster: the herald shows only under Favor  ·  ${r + 1} of ${seg.rows.length}`;
  }
  if (seg.id === 'throne') {
    wp(null);
    const f = S.fsm, cfg = D.def.segments.throne;
    if (!f) return seg.name;
    if (f.mode === 'final') return `The Emperor's Feast  ·  Kill Calus  ·  ${Math.ceil(f.finalLeft)}s`;
    if (f.mode === 'window') return `Damage Calus on the dais${S.enraged ? '  ·  Last audience' : ''}  ·  ${Math.ceil(f.windowLeft)}s`;
    const prog = S.round ? `${S.round.progress}/${S.round.order.length}` : '';
    if (G.player.status.has('mindscape')) return `Shoot the thoughts in the board's order  ·  ${prog}`;
    if (!fav) return 'Take a chalice from a Royal Taster, then meet Calus\'s Gaze';
    return `Step into Calus's Gaze to enter the Mindscape  ·  ${prog}${S.enraged ? '  ·  Enraged' : ''}`;
  }
  return seg.name;
}

// ---------- co-op ----------
export function snapC(D, S, seg) {
  if (seg.id === 'gauntlet') return { gs: S.rowsSt.map((x) => x.round.order[0]), go: S.rowsSt.map((x) => (x.open ? 1 : 0)), so: S.secretOpen ? 1 : 0 };
  if (seg.id === 'throne') {
    return {
      rd: S.round ? { o: S.round.order, p: S.round.progress, s: S.round.solved ? 1 : 0 } : 0, rn: S.roundNo, ls: S.mech.sigils,
      fs: S.fsm ? { m: S.fsm.mode, wl: Math.round(S.fsm.windowLeft * 10) / 10, fl: Math.round(S.fsm.finalLeft * 10) / 10 } : 0, en: S.enraged ? 1 : 0,
    };
  }
  return {};
}
export function onSnapC(D, S, seg, m) {
  if (seg.id === 'gauntlet' && m.gs) {
    m.gs.forEach((sg, r) => { const st = S.rowsSt[r]; if (st.round.order[0] !== sg) { st.round = { order: [sg], progress: 0, solved: false }; setRowSigil(S.mech, r, sg); } });
    m.go.forEach((o, r) => { if (!!o !== S.rowsSt[r].open) { S.rowsSt[r].open = !!o; setWall(S.mech, r, !!o); } });
    if (m.so && !S.secretOpen) { S.secretOpen = true; openSecretDoor(S.mech); H.placeSecret(D, D.segs.indexOf(S), seg.secretChest); }
  }
  if (seg.id === 'throne') {
    if (m.ls && m.ls.join() !== S.mech.sigils.join()) setLanternSigils(S.mech, m.ls);
    if (m.rd) { S.round = { order: m.rd.o, progress: m.rd.p, solved: !!m.rd.s }; S.roundNo = m.rn; drawMind(S.mech, S.round); } else S.round = null;
    S.fsm = m.fs ? { mode: m.fs.m, windowLeft: m.fs.wl, finalLeft: m.fs.fl, immune: m.fs.m === 'immune' } : null;
    S.enraged = !!m.en;
  }
}
export function onHostMsgC(D, m, from) {
  const S = D.segs[D.seg], seg = D.layout.segments[D.seg];
  if (m.k === 'gof' && seg.id === 'gauntlet') { judgeGOffer(D, S, seg, m.r, m.i, from); return true; }
  if (m.k === 'lan' && seg.id === 'throne') { judgeLantern(D, S, seg, m.i, from); return true; }
  return false;
}
export function onFxC(D, m) {
  const find = (id) => D.layout.segments.findIndex((s) => s.id === id);
  if (m.k === 'gof') { const i = find('gauntlet'); gOfferFx(D, D.segs[i], m.r, m.i, m.res, m.who === H.localId() ? m.n : -1); return true; }
  if (m.k === 'lan') { const i = find('throne'); lanternFx(D, D.segs[i], m.i, m.res, m.who === H.localId() ? m.n : -1); return true; }
  if (m.k === 'twin') { endMind(); banner('Calus Descends', m.w ? (m.en ? 'This is the last audience. Finish him or face his Feast' : 'The Emperor grows impatient: one more audience after this') : 'Damage window. On the dais', 2.8, 'alert'); return true; }
  if (m.k === 'feast') { endMind(); banner("The Emperor's Feast", 'He raises his goblet. Kill him before he drinks', 3.4, 'alert'); return true; }
  if (m.k === 'feastwipe') { feastWipe(); return true; }
  return false;
}
/** Dev console helpers. */
export function devC(D) {
  const S = D.segs[D.seg], seg = D.layout.segments[D.seg];
  return {
    herald: () => (seg.id === 'gauntlet' ? S.rowsSt.map((x) => x.round.order[0]).join(' > ') : 'Not in the Gauntlet'),
    openRow: (r) => { if (seg.id !== 'gauntlet') return 'Not in the Gauntlet'; const st = S.rowsSt[r]; st.open = true; setWall(S.mech, r, true); return `Row ${r} open`; },
    mind: () => { if (seg.id !== 'throne') return 'Not in the Throne'; G.player.status.apply('mindscape', { t: 20, set: true }); return S.round ? S.round.order.join(' > ') : 'No round'; },
    solve: () => { if (seg.id !== 'throne' || !S.round) return 'No round'; for (const sg of S.round.order.slice(S.round.progress)) judgeLantern(D, S, seg, S.mech.sigils.indexOf(sg), H.localId()); return S.fsm.mode; },
    fsm: () => (S.fsm ? { mode: S.fsm.mode, phases: S.fsm.phases, enraged: S.enraged, warned: S.fsm.warned, windowLeft: S.fsm.windowLeft, finalLeft: S.fsm.finalLeft } : null),
  };
}
