// U21 "Exotic Missions": the registry and every rule that needs no scene, so tools/tests.js can check them.
// exotic-missions.js (the runtime) and mechanics.js (the interactive objects) build on these. No Three.js, no DOM.
import { UNITS } from './factions.js';
import { fireteamScale } from './tiers.js';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
// `layout`: the module that exports the level set, the location (`WHISPER_LOC`) and the layout (`WHISPER_LAYOUT`).
// `segments`: per layout segment id, what the framework spawns and which puzzle it runs. Unit lists are [unitId, count] and
// scale with the fireteam (scaledCount). `g` is the difficulty band the mission plays at (enemy health and damage grow with it as in the campaign).
export const EXOTIC_MISSIONS = {
  whisper: {
    id: 'whisper',
    name: 'The Whisper',
    kicker: 'Io  ·  The Pyramidion, below',
    desc: 'Something under Io has been whispering to the Taken. Follow the Vex conduits down, let their light attune you, and silence what is listening. Twenty minutes. Respawns are restricted.',
    unlockLevel: 30,
    timeLimit: 1200,
    layout: 'level-whisper',
    reward: 'Blight Edge',
    enemyLightOver: 10,
    g: 18,
    boss: { name: 'Aurix, Hollowed Mind', model: 'takenMind', element: 'void' },
    attuneTime: 20, // seconds of Attuned a conduit gives (refreshed while you stand in its light)
    conduitRadius: 1.2,
    blightRadius: 5, // a Taken blight drains Attuned inside this radius
    blightHits: 6, // shots to destroy a blight
    segments: {
      descent: { puzzle: { mode: 'any', need: 3 }, waves: [[['tk_thrall', 3], ['tk_acolyte', 2]], [['tk_acolyte', 2], ['tk_vandal', 1], ['tk_thrall', 2]]], wrongWave: [] },
      shaft: { harass: [['tk_vandal', 2], ['tk_psion', 2], ['tk_acolyte', 1]] },
      gallery: { puzzle: { mode: 'order', need: 4, of: 6 }, waves: [[['tk_thrall', 3], ['tk_acolyte', 3], ['tk_captain', 1]]], wrongWave: [['tk_thrall', 3], ['tk_acolyte', 1]] },
      chasm: { ambushKit: [['tk_thrall', 3], ['tk_acolyte', 2], ['tk_psion', 1]] },
      falls: { windowTime: 12, litMove: 15, phaseLens: [3, 4, 5], eyeCount: 8, addsKit: [['tk_thrall', 3], ['tk_acolyte', 2], ['tk_goblin', 1]], wrongWave: [['tk_thrall', 2]], pulseEvery: 9, orbEvery: 3.6 },
    },
  },
};

export const exoticList = () => Object.values(EXOTIC_MISSIONS);
export function exoticDef(id) {
  const d = EXOTIC_MISSIONS[id];
  if (!d) throw new Error(`Unknown exotic mission "${id}"`);
  return d;
}

/** Checks a registry entry (also run by the tests): every unit exists, numbers are sane. Returns a list of problems. */
export function validateExotic(d) {
  const bad = [];
  const need = (c, m) => { if (!c) bad.push(m); };
  need(d.id && d.name && d.reward && d.layout, 'id, name, reward and layout are required');
  need(d.unlockLevel >= 1 && d.timeLimit > 0 && d.enemyLightOver >= 0 && d.g >= 0, 'unlockLevel, timeLimit, enemyLightOver and g');
  need(d.boss?.name && d.boss.model, 'boss');
  for (const [seg, c] of Object.entries(d.segments || {})) {
    const kits = [...(c.waves || []).flat(), ...(c.harass || []), ...(c.ambushKit || []), ...(c.wrongWave || []), ...(c.addsKit || [])];
    for (const [t, n] of kits) { need(UNITS[t], `${seg}: unknown unit ${t}`); need(n >= 1, `${seg}: bad count for ${t}`); }
    if (c.puzzle) need(c.puzzle.need >= 1 && (c.puzzle.mode === 'any' || c.puzzle.of >= c.puzzle.need), `${seg}: puzzle`);
  }
  return bad;
}

// ---------------------------------------------------------------------------
// Unlock, record, rewards
// ---------------------------------------------------------------------------
export const exoticUnlocked = (level, d) => level >= d.unlockLevel;
export const exoticLockText = (d) => `Requires level ${d.unlockLevel}`;
/** Enemy Light: the combat Light (the leader's in a fireteam) plus the mission's margin. */
export const exoticEnemyLight = (combat, d) => combat + d.enemyLightOver;

/** This Guardian's record for a mission, created when missing (older saves migrate on load; this keeps a new mission id safe). */
export function exoticRecord(s, id) {
  s.exoticMissions ||= {};
  return (s.exoticMissions[id] ||= { clears: 0, bestTime: null });
}
/** Records a clear (seconds used). Returns { first, record, newBest }. */
export function recordExoticClear(s, id, seconds) {
  const r = exoticRecord(s, id);
  const first = r.clears === 0;
  const newBest = r.bestTime == null || seconds < r.bestTime;
  r.clears++;
  if (newBest) r.bestTime = Math.round(seconds * 10) / 10;
  return { first, record: r, newBest };
}
/** What a clear pays: the exotic once per Guardian, then two legendary drops. Read before recordExoticClear. */
export function rewardPlan(s, d) {
  return exoticRecord(s, d.id).clears === 0 ? { first: true, exotic: d.reward, legendary: 0 } : { first: false, exotic: null, legendary: 2 };
}

/** Unit counts scale with the fireteam as in the campaign (+50% for two, double for three). */
export const scaledCount = (n, fireteam) => Math.max(1, Math.round(n * fireteamScale(fireteam).count));
/** A kit [[unitId, n], ...] as a flat list of unit ids for this fireteam size. */
export function expandKit(kit, fireteam) {
  const out = [];
  for (const [t, n] of kit) for (let i = 0; i < scaledCount(n, fireteam); i++) out.push(t);
  return out;
}

// ---------------------------------------------------------------------------
// The 20:00 timer
// ---------------------------------------------------------------------------
export const newTimer = (limit) => ({ left: limit, limit, frozen: false, expired: false });
/** Counts down; frozen (boss dead) or expired timers do not move. Never adds time. */
export function stepTimer(t, dt) {
  if (t.frozen || t.expired) return t;
  t.left = Math.max(0, t.left - Math.max(0, dt));
  if (t.left <= 0) t.expired = true;
  return t;
}
export function freezeTimer(t) { if (!t.expired) t.frozen = true; return t; }
export const timeUsed = (t) => t.limit - t.left;
export const clock = (sec) => { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const timerRed = (t) => !t.frozen && t.left <= 60;

// ---------------------------------------------------------------------------
// Respawn rules
// ---------------------------------------------------------------------------
// Solo: a death or a fall into the void restarts the current segment at its checkpoint (no revive count; the timer is the limit).
// Fireteam: nobody respawns on their own (no pooled lives, no down timer): only a teammate's revive brings you back.
// A void fall in a fireteam puts your downed body at your last safe grounded position. Everyone down is a wipe: the segment resets.
export const RESPAWN_DELAY = 3;
export function deathOutcome({ fireteam, cause }) {
  if (cause !== 'death' && cause !== 'void') throw new Error(`deathOutcome: unknown cause "${cause}"`);
  if (fireteam <= 1) {
    return { action: 'segment-reset', respawnIn: RESPAWN_DELAY, title: cause === 'void' ? 'You Fell' : 'You Died', sub: 'No revive is spent: the segment restarts at its checkpoint' };
  }
  if (cause === 'void') return { action: 'downed-at-safe', respawnIn: null, title: 'You Fell', sub: 'Respawns restricted: your body waits where you last stood. A teammate must revive you' };
  return { action: 'stay-down', respawnIn: null, title: 'You Died', sub: 'Respawns restricted: a teammate must revive you' };
}
/** Every player down (the list holds one dead flag per player in the mission). */
export const isWipe = (deadFlags) => deadFlags.length > 0 && deadFlags.every(Boolean);
export const wipeOutcome = (deadFlags) => (isWipe(deadFlags) ? { action: 'wipe-reset', title: 'Fireteam Down', sub: 'The segment restarts at its checkpoint' } : { action: 'none' });
/** The line shown in the death panel while down. */
export function downText(fireteam) {
  return fireteam > 1 ? 'Respawns restricted: a teammate must revive you' : '';
}
/** The last safe spot: updated while grounded and not over a phase block (those vanish when Attuned ends). */
export function trackSafe(prev, pos, onGround, overPhase) {
  return onGround && !overPhase ? { x: pos.x, y: pos.y, z: pos.z } : prev;
}
export const inVoid = (y, voidY) => y < voidY;

// ---------------------------------------------------------------------------
// Glyph puzzles
// ---------------------------------------------------------------------------
export const GLYPH_SYMBOLS = ['▲', '●', '■', '◆', '✚', '★', '⬢', '☾'];

/** Fisher-Yates with an injectable random source. */
export function shuffled(list, rnd = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * A puzzle over `eyes` eyes. mode 'order': shoot `len` eyes in the shown order (a wrong eye resets the set). mode 'any': shoot `len` different eyes.
 * Each eye carries one symbol (distinct); `order` lists the eye indices the glyph shows, in sequence.
 */
export function makeGlyphPuzzle(rnd, eyes, len, mode = 'order') {
  if (len > eyes) throw new Error(`makeGlyphPuzzle: ${len} of ${eyes} eyes`);
  const symbols = shuffled(GLYPH_SYMBOLS.map((_, i) => i), rnd).slice(0, eyes);
  const order = shuffled(Array.from({ length: eyes }, (_, i) => i), rnd).slice(0, len);
  return { mode, eyes, len, order, symbols, progress: 0, lit: [], solved: false, wrongs: 0 };
}
/**
 * One shot on eye `i`. Returns 'solved' (the last correct eye), 'correct', 'wrong' (the set resets: the caller sends a wave) or
 * 'ignored' (the puzzle is solved, or the eye is already lit, which also covers a held trigger hitting the same eye twice).
 */
export function glyphShoot(p, i) {
  if (p.solved || p.lit.includes(i)) return 'ignored';
  if (p.mode === 'any') {
    p.lit.push(i);
    p.progress = p.lit.length;
    if (p.progress >= p.len) { p.solved = true; return 'solved'; }
    return 'correct';
  }
  if (i === p.order[p.progress]) {
    p.lit.push(i);
    p.progress++;
    if (p.progress >= p.len) { p.solved = true; return 'solved'; }
    return 'correct';
  }
  p.progress = 0; p.lit = []; p.wrongs++;
  return 'wrong';
}
/** Puts a puzzle back to its start (same order), as a segment reset does. */
export function resetGlyph(p) { p.progress = 0; p.lit = []; p.solved = false; return p; }

// ---------------------------------------------------------------------------
// Boss immunity phases (Aurix)
// ---------------------------------------------------------------------------
/** After phase n (1 to 3) the boss may not be below this share of its health: at most a third is lost per phase. */
export const bossFloorFrac = (phase) => Math.max(0, 1 - phase / 3);
/** Damage allowed given the boss's health, the floor it may not pass in this window and the damage dealt. */
export const capDamage = (hp, floorHp, dmg) => Math.max(0, Math.min(dmg, hp - floorHp));

/**
 * The boss's phase machine. Immune until its glyph order is shot; then a damage window (cfg.windowTime s) in which the boss can lose
 * health down to this phase's floor. The window ends when time runs out or the floor is reached; the next phase follows (phase 3 repeats
 * with a fresh glyph until the boss falls). Phase 2 lights one of the conduits at a time and moves it every cfg.litMove seconds.
 */
export class BossFsm {
  constructor(cfg, conduits, rnd = Math.random) {
    this.cfg = cfg; this.rnd = rnd; this.conduits = conduits;
    this.phase = 1; this.mode = 'immune'; this.windowLeft = 0;
    this.puzzle = makeGlyphPuzzle(rnd, cfg.eyeCount, cfg.phaseLens[0], 'order');
    this.lit = -1; this.litT = 0; // -1: every conduit lit
    this.applyPhase();
  }
  get immune() { return this.mode !== 'window'; }
  get blightsOn() { return this.phase === 3; }
  floorHp(maxHp) { return (maxHp * (3 - this.phase)) / 3; }
  applyPhase() {
    this.lit = this.phase === 2 ? Math.floor(this.rnd() * this.conduits) : -1;
    this.litT = this.cfg.litMove;
  }
  /** An eye was shot: the glyph result, and the window opens when it is solved. */
  shoot(i) {
    if (this.mode !== 'immune') return 'ignored';
    const r = glyphShoot(this.puzzle, i);
    if (r === 'solved') { this.mode = 'window'; this.windowLeft = this.cfg.windowTime; }
    return r;
  }
  /** Advance time. Returns 'window-end' (with `ended: 'time' | 'floor'`) or 'lit-moved' or null. */
  tick(dt, hp, maxHp) {
    let ev = null;
    if (this.phase === 2 && this.conduits > 1) {
      this.litT -= dt;
      if (this.litT <= 0) {
        this.litT = this.cfg.litMove;
        let n = Math.floor(this.rnd() * (this.conduits - 1));
        if (n >= this.lit) n++;
        this.lit = n; ev = 'lit-moved';
      }
    }
    if (this.mode === 'window') {
      this.windowLeft -= dt;
      const atFloor = hp <= this.floorHp(maxHp) + 1e-6;
      if (this.windowLeft <= 0 || atFloor) {
        this.ended = atFloor ? 'floor' : 'time';
        this.mode = 'immune'; this.windowLeft = 0;
        if (this.phase < 3) this.phase++;
        this.puzzle = makeGlyphPuzzle(this.rnd, this.cfg.eyeCount, this.cfg.phaseLens[this.phase - 1], 'order');
        this.applyPhase();
        ev = 'window-end';
      }
    }
    return ev;
  }
  /** A wrong eye resets the set (glyphShoot did it); the caller spawns the penalty wave. */
  snapshot() { return { ph: this.phase, im: this.immune ? 1 : 0, wl: Math.round(this.windowLeft * 10) / 10, lit: this.lit, ord: this.puzzle.order, sy: this.puzzle.symbols, pr: this.puzzle.progress, li: this.puzzle.lit }; }
}

// ---------------------------------------------------------------------------
// Blight Edge: Blight Harvest (the Whisper's exotic)
// ---------------------------------------------------------------------------
export const BLIGHT = { chance: 0.5, critChance: 1, chainMul: 0.5, maxDepth: 3, fuse: 1.2, radius: 4, weaken: 4 };
/**
 * Chance that a kill leaves a blight bomb. `depth` is how many bombs deep the killer is: 0 for a weapon kill, 1 to 3 for a kill by a
 * bomb. A bomb kill has half the normal (non-precision) chance, and nothing chains past BLIGHT.maxDepth bombs.
 */
export function blightChance(crit, depth = 0) {
  if (depth >= BLIGHT.maxDepth) return 0;
  if (depth > 0) return BLIGHT.chance * BLIGHT.chainMul;
  return crit ? BLIGHT.critChance : BLIGHT.chance;
}

// ---------------------------------------------------------------------------
// Layout contract (js/level-whisper.js) and damage gate
// ---------------------------------------------------------------------------
export const inRegion = (p, r) => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ && p.y >= (r.minY ?? -Infinity) && p.y <= (r.maxY ?? Infinity);

/** Damage that may land on an exotic-mission boss: none while immune, and never below this window's floor. Other enemies are untouched. */
export function gateDamage(e, dmg) {
  if (!e.exoBoss) return dmg;
  if (e.exoImm) return 0;
  return capDamage(e.hp, e.hpFloor ?? 0, dmg);
}

/** Checks a layout against the contract in docs/U21_PROPOSAL.md. Returns a list of problems (empty when valid). */
export function validateLayout(layout, d) {
  const bad = [];
  const need = (c, m) => { if (!c) bad.push(m); };
  const pt = (a) => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
  need(pt(layout?.spawn), 'spawn');
  need(Number.isFinite(layout?.voidY), 'voidY');
  need(Array.isArray(layout?.segments) && layout.segments.length > 0, 'segments');
  for (const s of layout?.segments || []) {
    const w = `segment ${s.id}`;
    need(['encounter', 'traversal', 'boss'].includes(s.kind), `${w}: kind`);
    need(pt(s.checkpoint), `${w}: checkpoint`);
    need(s.region && ['minX', 'maxX', 'minZ', 'maxZ'].every((k) => Number.isFinite(s.region[k])), `${w}: region`);
    const cfg = d.segments[s.id];
    need(cfg, `${w}: not in the registry`);
    if (s.kind === 'encounter') {
      need((s.conduits || []).length >= 1 && (s.conduits || []).every(pt), `${w}: conduits`);
      need((s.eyes || []).length >= (cfg?.puzzle?.of ?? cfg?.puzzle?.need ?? 1) && (s.eyes || []).every((e) => pt(e.p) && Array.isArray(e.n) && e.n.length === 2), `${w}: eyes`);
      need(s.gate && pt(s.gate.p) && s.gate.w > 0 && s.gate.h > 0 && ['x', 'z'].includes(s.gate.axis), `${w}: gate`);
      need((s.spawns || []).length >= 1 && s.spawns.every(pt), `${w}: spawns`);
      if (s.id === 'gallery') need(pt(s.glyph) && (s.blights || []).length >= 1, `${w}: glyph and blights`);
    } else if (s.kind === 'traversal') {
      need(s.exit && pt(s.exit.p) && s.exit.r > 0, `${w}: exit`);
      need((s.phaseBlocks || []).every((b) => pt(b.p) && pt(b.s)), `${w}: phaseBlocks`);
      if (cfg?.harass) need((s.spawns || []).length >= 1, `${w}: spawns`);
      if (cfg?.ambushKit) need((s.ambush || []).length >= 1 && s.ambush.every((a) => pt(a.p) && a.r > 0 && (a.spawns || []).length >= 1), `${w}: ambush`);
    } else if (s.kind === 'boss') {
      need(pt(s.boss) && pt(s.glyph) && pt(s.chest), `${w}: boss, glyph, chest`);
      need((s.conduits || []).length === 4, `${w}: four conduits`);
      need((s.eyes || []).length === (cfg?.eyeCount ?? 8), `${w}: eyes`);
      need((s.spawns || []).length >= 1, `${w}: spawns`);
    }
  }
  const last = layout?.segments?.[layout.segments.length - 1];
  need(last?.kind === 'boss', 'the last segment must be the boss');
  return bad;
}
