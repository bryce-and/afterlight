// U25 Crucible chunk B: the networked match. Same star topology as co-op (js/net.js, PeerJS or ?localtest):
//  - every human sends its own state ('pp', 20 Hz) to the host; the host relays them, the AI Guardians' bodies, the zones, the score, the
//    crates, the Duel round and the clock in one snapshot ('cs', 15 Hz);
//  - a shot is resolved by the SHOOTER (the same trust model as the co-op 'hit'): it sends 'pvh' (victim, damage, one-hit flag) to the host,
//    which checks it (acceptPvpHit) and relays it to the victim; the victim applies the damage and reports a death ('pvd');
//  - the host owns the score: it turns a death into points, broadcasts the kill ('pvk') and the end of the match ('pve').
// Player damage still exists only when the mission is `pvp: true`: every handler here starts by checking that switch.
import { G } from './state.js';
import { net, send, sendTo, broadcast } from './net.js';
import { acceptPvpHit, CRATES } from './pvp.js';
import {
  recordKill, descOf, localDesc, endMatch, ensurePuppet, resetLocalRound, crateReadyState, crateConsumed, takeCrateLocal, removeFighter, pvpDamagePlayer, localKill, roundBanner,
} from './crucible.js';

const r2 = (v) => Math.round(v * 100) / 100;
const OWNER = [null, 'blue', 'red'];
let sendT = 0, snapT = 0, idT = 0, lastKey = '', keyT = 0;

/** A machine's crucible match, or null (also null when the mission is not a PvP match: every handler below stops there). */
const matchOf = () => (G.mission?.pvp === true ? G.mission.crucible || null : null);

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------
/** The local player's row: place, heading, flags (1 dead, 2 sprinting, 4 airborne, 8 firing) and the health pool in thousandths. */
function myRow() {
  const P = G.player;
  const f = (P.dead ? 1 : 0) | (P.sprinting ? 2 : 0) | (P.onGround ? 0 : 4) | (G.time - P.lastFire < 0.15 ? 8 : 0);
  const pool = P.maxHealth + P.maxShield;
  return [r2(P.pos.x), r2(P.pos.y), r2(P.pos.z), r2(P.yaw), f, Math.max(0, Math.round(((P.health + P.shield) / pool) * 1000))];
}
const weaponKey = () => { const wi = G.player.weapon.item; return `${wi.arch}|${wi.rarity}|${wi.element}|${wi.rarity === 'exotic' ? wi.name : ''}`; };
const identity = () => ({ c: G.save.classId, sc: G.player.cls.subclassId, lk: G.player.lookCode, w: weaponKey() });

/** Report a hit on `victimGid` (a human's id or an AI Guardian's 'g<n>'). `byGid` is null for the local player. Called from a puppet's takePvp. */
export function crSendHit(victimGid, dmg, oneHit, byGid) {
  const C = matchOf();
  if (!C || !net.active || C.over) return;
  const by = byGid || net.myId;
  const d = Math.round(dmg * 10) / 10;
  if (net.isHost) {
    const v = C.fighters.get(victimGid);
    if (v?.humanId) sendTo(v.humanId, { t: 'pvh', v: v.humanId, d, oh: oneHit ? 1 : 0, by }); // the victim applies it
  } else send({ t: 'pvh', v: victimGid, d, oh: oneHit ? 1 : 0, by });
}

/** Tell the host the local player died (a client only; the host scores its own death directly). `byGid`: the killer, or null. */
export function crSendDeath(byGid) { if (net.isClient) send({ t: 'pvd', by: byGid || null }); }
/** A client asks for a ready crate it stands on. */
export function crRequestCrate(i) { if (net.isClient) send({ t: 'pvc', i }); }
/** Host: a human left the match (the others drop their body). */
export function crMemberLeft(id) {
  const C = matchOf();
  if (!C) return;
  const was = C.fighters.get(id);
  removeFighter(id);
  if (net.isHost) broadcast({ t: 'pvl', id });
  if (was && C.duel && !C.over && !C.spectate) endMatch(G.mission.team); // the other Duelist left: you win
}

/** Per frame (called from coop.js netTick during a PvP match). */
export function crNetTick(dt) {
  const C = matchOf();
  if (!C || !net.active || G.state !== 'playing') return;
  sendT -= dt; snapT -= dt; idT -= dt; keyT -= dt;
  const w = C.spectate ? '' : weaponKey();
  if (net.isClient && !C.spectate && sendT <= 0) {
    sendT = 0.05;
    const withId = idT <= 0 || w !== lastKey;
    if (withId) { idT = 1; lastKey = w; }
    send({ t: 'pp', r: myRow(), ...(withId ? { i: identity() } : null) });
  }
  if (net.isHost && snapT <= 0) { snapT = 1 / 15; broadcast(snapshot(C, keyT <= 0 ? (keyT = 1, true) : false)); }
}

/** Host: everything every client needs for the next frame. `key`: also resend each human's identity (class, look, weapon). */
function snapshot(C, key) {
  const h = [], a = [];
  if (!C.spectate) h.push([net.myId, ...myRow(), ...(key ? [identity()] : [])]);
  for (const g of C.guardians) {
    const f = (g.alive ? 0 : 1) | (g.speedNow > 5 ? 2 : 0) | (g.netAir ? 4 : 0) | (g.firing ? 8 : 0);
    const pool = Math.round(((g.hp + g.shield) / (g.maxHp + g.maxShield)) * 1000);
    if (g.humanId) { if (g.seen) h.push([g.humanId, r2(g.netPos.x), r2(g.netPos.y), r2(g.netPos.z), r2(g.netYaw), (g.alive ? 0 : 1) | (g.netSprint ? 2 : 0) | (g.netAir ? 4 : 0) | (g.netFire ? 8 : 0), pool, ...(key && g.ident ? [g.ident] : [])]); }
    else a.push([g.gid, r2(g.pos.x), r2(g.pos.y), r2(g.pos.z), r2(g.yaw), f, pool, g.weaponSlot ?? 0]); // U29: which gun it holds
  }
  const m = {
    t: 'cs', tl: Math.round(C.timeLeft * 10) / 10, sc: [C.score.blue, C.score.red], h, a,
    z: C.zones.map((z) => [OWNER.indexOf(z.owner), Math.round((z.prog || 0) * 1000)]),
    cr: C.crates.reduce((b, c, i) => (c.ready ? b | (1 << i) : b), 0),
  };
  if (C.duel) m.du = [C.duel.round, C.duel.phase === 'between' ? 1 : 0, Math.round(C.duel.t * 10) / 10];
  return m;
}

// ---------------------------------------------------------------------------
// Receiving
// ---------------------------------------------------------------------------
/** Move a body (a human's or an AI Guardian's puppet) to a row. */
function applyRow(g, x, y, z, yaw, f, pool) {
  g.netPos.set(x, y, z); g.netYaw = yaw;
  g.netSprint = !!(f & 2); g.netAir = !!(f & 4); g.netFire = !!(f & 8);
  if (!g.seen) { g.seen = true; g.pos.copy(g.netPos); g.yaw = yaw; }
  g.setNetAlive(!(f & 1));
  if (g.alive) { g.hp = Math.min(g.maxHp, (pool / 1000) * (g.maxHp + g.maxShield)); g.shield = Math.max(0, (pool / 1000) * (g.maxHp + g.maxShield) - g.hp); }
}

// host <- client: a human's own state
net.on('pp', (m, from) => {
  const C = matchOf();
  if (!C || !net.isHost || !Array.isArray(m.r)) return;
  let g = C.fighters.get(from);
  if (m.i) { C.ident.set(from, m.i); if (g) g.setGunKey(m.i.w); else g = ensurePuppet(from, m.i); }
  if (!g) return; // the first row of a human arrives with its identity
  g.ident = C.ident.get(from);
  applyRow(g, ...m.r);
});

// client <- host: the match state
net.on('cs', (m) => {
  const C = matchOf();
  if (!C || net.isHost) return;
  const Mi = G.mission;
  for (const row of m.h) {
    const [id, x, y, z, yaw, f, pool, ident] = row;
    if (id === net.myId) continue;
    let g = C.fighters.get(id);
    if (ident) { if (g) g.setGunKey(ident.w); else g = ensurePuppet(id, ident); }
    if (g) applyRow(g, x, y, z, yaw, f, pool);
  }
  for (const [gid, x, y, z, yaw, f, pool, ws] of m.a) { const g = C.fighters.get(gid); if (g) { applyRow(g, x, y, z, yaw, f, pool); g.holdSlot?.(ws ?? 0); } }
  C.score.blue = m.sc[0]; C.score.red = m.sc[1]; C.timeLeft = m.tl;
  m.z.forEach(([o, p], i) => { const z = C.zones[i]; if (z) { z.owner = OWNER[o]; z.prog = p / 1000; } });
  C.crates.forEach((c, i) => crateReadyState(c, !!(m.cr & (1 << i))));
  if (m.du && C.duel) {
    const [n, ph, t] = m.du;
    C.duel.phase = ph ? 'between' : 'live'; C.duel.t = t;
    if (n !== C.duel.round) { C.duel.round = n; resetLocalRound(); }
  }
  void Mi;
});

// a hit: from a client's shooter to the host, or from the host to the victim
net.on('pvh', (m, from) => {
  const C = matchOf(), Mi = G.mission;
  if (!C || C.over || Mi.phase === 'done' || C.duel?.phase === 'between') return; // `pvp: true` is the one switch
  const me = net.myId;
  if (m.v === me) {
    const att = C.fighters.get(m.by);
    if (!att || !att.alive || Mi.spectate) return;
    if (!acceptPvpHit(Mi, net.isHost ? from : m.by, m.by, att.team, Mi.team, m.d)) return;
    pvpDamagePlayer(m.d, { attacker: att, oneHit: !!m.oh, from: att.pos });
    return;
  }
  if (!net.isHost) return;
  const sh = C.fighters.get(from), vf = C.fighters.get(m.v);
  if (!sh || !sh.alive || !vf || !vf.alive) return;
  if (!acceptPvpHit(Mi, from, m.by, sh.team, vf.team, m.d)) return;
  if (vf.humanId) sendTo(vf.humanId, { t: 'pvh', v: vf.humanId, d: m.d, oh: m.oh, by: from });
  else if (!vf.puppet) vf.takePvp(m.d, !!m.oh, sh);
});

// host <- the victim: I died
net.on('pvd', (m, from) => {
  const C = matchOf();
  if (!C || !net.isHost || C.over) return;
  const v = C.fighters.get(from);
  if (!v || v.deathScored) return;
  v.deathScored = true; v.setNetAlive(false);
  const k = m.by === net.myId && !C.spectate ? localDesc() : m.by ? (C.fighters.get(m.by) ? descOf(C.fighters.get(m.by)) : null) : null; // the host's own player is not a body in `fighters`
  if (k && k.team === v.team) return; // never a team kill
  recordKill(descOf(v), k || { id: null, name: 'The map', team: v.team === 'blue' ? 'red' : 'blue' }, (m.by && C.fighters.get(m.by)?.how) || '');
});

// client <- host: a kill happened (the feed line, and the killer's own feedback)
net.on('pvk', (m) => {
  const C = matchOf();
  if (!C || net.isHost) return;
  C.feed.push({ t: G.time, killer: m.k, victim: m.v, kteam: m.kt, vteam: m.vt, pts: m.pts, how: m.h || '' });
  if (C.feed.length > 6) C.feed.shift();
  if (m.kid === net.myId) localKill(true);
});

// crates: a client asks, the host decides
net.on('pvc', (m, from) => {
  const C = matchOf();
  if (!C || !net.isHost) return;
  const c = C.crates[m.i], p = C.fighters.get(from);
  if (!c || !c.ready || !p || !p.alive || Math.hypot(p.pos.x - c.x, p.pos.z - c.z) > CRATES.pickupR * 2) return;
  crateConsumed(c);
  sendTo(from, { t: 'pvca', i: m.i });
});
net.on('pvca', (m) => { const C = matchOf(); if (C && net.isClient) takeCrateLocal(C.crates[m.i]); });

// the end, a Duel round, a human leaving
net.on('pve', (m) => {
  const C = matchOf();
  if (!C || net.isHost || C.over) return;
  C.score.blue = m.sc[0]; C.score.red = m.sc[1];
  endMatch(m.w);
});
net.on('pvrd', (m) => { const C = matchOf(); if (C && net.isClient) { C.score.blue = m.sc[0]; C.score.red = m.sc[1]; roundBanner(m.w, m.n); } });
net.on('pvl', (m) => { const C = matchOf(); if (C && net.isClient) removeFighter(m.id); });

