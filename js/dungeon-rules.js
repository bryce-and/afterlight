// U23 "The Emperor's Shadow": the dungeon registry and every dungeon rule that needs no scene, so tools/tests.js can check them.
// js/dungeon.js (the runtime) and js/dungeon-mech.js (plates, sigils, pools, censers) build on these. No Three.js, no DOM.
// A dungeon is not an exotic mission: no timer, encounter checkpoints, several bosses, DPS windows (never damage gates), and the
// final boss's enrage and final stand (docs/ENDGAME_RULES.md). The Whisper's rules (exotic-rules.js) are only read here, never changed.
import { UNITS } from './factions.js';
import { fireteamScale } from './tiers.js';

// ---------------------------------------------------------------------------
// The four imperial sigils, drawn as vector shapes (never font characters). Coordinates in [-1, 1], y up.
// Each shape is a list of parts: { c: [cx, cy, r] } a disc, { p: [[x, y], ...] } a polygon. inSigil tests a point;
// the canvas draws the same parts, so what the readability test checks is what players see.
// ---------------------------------------------------------------------------
export const SIGILS = ['axes', 'chalice', 'sun', 'hound'];
export const SIGIL_NAMES = { axes: 'Axes', chalice: 'Chalice', sun: 'Sun', hound: 'Hound' };

const rot = (pts, a) => pts.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
const bar = (w, h) => [[-w, -h], [w, -h], [w, h], [-w, h]];
const axeHalf = (s) => { // one axe: a haft from the lower corner to the upper, a wide crescent blade at the top
  const haft = rot(bar(0.07, 0.95), s * Math.PI / 4);
  const blade = rot([[-0.05, 0.42], [0.42, 0.62], [0.5, 0.86], [0.36, 1.0], [-0.05, 0.78]].map(([x, y]) => [x * s, y]), s * Math.PI / 4);
  return [{ p: haft }, { p: blade }];
};
const sunRays = () => {
  const out = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, w = 0.11, r0 = 0.32, r1 = i % 2 ? 0.72 : 0.97;
    out.push({ p: [[Math.cos(a - w) * r0, Math.sin(a - w) * r0], [Math.cos(a) * r1, Math.sin(a) * r1], [Math.cos(a + w) * r0, Math.sin(a + w) * r0]] });
  }
  return out;
};
const cup = () => { // the bowl: the lower half of an ellipse, flat rim on top
  const pts = [];
  for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * Math.PI; pts.push([Math.cos(a) * 0.68, 0.72 + Math.sin(a) * 0.5]); }
  return pts;
};
export const SIGIL_SHAPES = {
  axes: [...axeHalf(1), ...axeHalf(-1)],
  chalice: [{ p: cup() }, { p: [[-0.07, 0.24], [0.07, 0.24], [0.07, -0.6], [-0.07, -0.6]] }, { c: [0, -0.12, 0.13] }, { p: [[-0.5, -0.92], [0.5, -0.92], [0.3, -0.62], [-0.3, -0.62]] }, { p: [[0.4, 0.3], [0.48, 0.3], [0.46, 0.0], [0.42, 0.0]] }],
  sun: [{ c: [0, 0, 0.36] }, ...sunRays()],
  hound: [ // a war beast in profile, facing left: body, chest, head and jaw, spiked back, legs, tail
    { p: [[-0.55, 0.18], [0.5, 0.25], [0.62, -0.05], [0.4, -0.22], [-0.45, -0.2]] },
    { p: [[-0.95, 0.12], [-0.55, 0.36], [-0.42, 0.05], [-0.62, -0.12], [-0.98, -0.06]] },
    { p: [[-0.95, -0.06], [-0.62, -0.12], [-0.7, -0.24], [-0.92, -0.2]] },
    { p: [[-0.4, 0.2], [-0.3, 0.55], [-0.18, 0.22]] }, { p: [[-0.12, 0.23], [0.0, 0.6], [0.1, 0.24]] }, { p: [[0.16, 0.24], [0.3, 0.52], [0.38, 0.25]] },
    { p: [[-0.5, -0.15], [-0.36, -0.15], [-0.38, -0.85], [-0.52, -0.85]] }, { p: [[-0.2, -0.18], [-0.07, -0.18], [-0.1, -0.85], [-0.24, -0.85]] },
    { p: [[0.2, -0.2], [0.34, -0.2], [0.34, -0.85], [0.2, -0.85]] }, { p: [[0.42, -0.15], [0.56, -0.1], [0.6, -0.85], [0.46, -0.85]] },
    { p: [[0.55, 0.12], [0.95, 0.45], [0.98, 0.36], [0.62, -0.02]] },
  ],
};
function inPoly(pts, x, y) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
/** True when (x, y) in [-1, 1] is inside the sigil. */
export function inSigil(name, x, y) {
  const parts = SIGIL_SHAPES[name];
  if (!parts) throw new Error(`Unknown sigil "${name}"`);
  return parts.some((q) => (q.c ? Math.hypot(x - q.c[0], y - q.c[1]) <= q.c[2] : inPoly(q.p, x, y)));
}
export function sigilMask(name, n = 32) {
  const m = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) m.push(inSigil(name, -1 + (2 * (i + 0.5)) / n, 1 - (2 * (j + 0.5)) / n));
  return m;
}
/** Intersection over union of two sigils' silhouettes (lower is easier to tell apart). */
export function sigilOverlap(a, b, n = 32) {
  const A = sigilMask(a, n), B = sigilMask(b, n);
  let both = 0, either = 0;
  for (let k = 0; k < A.length; k++) { if (A[k] && B[k]) both++; if (A[k] || B[k]) either++; }
  return either ? both / either : 0;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
// `layout`: the module exporting SHADOW_LOC and SHADOW_LAYOUT. `segments`: per layout segment id, what the runtime spawns.
// Unit lists are [unitId, count] and scale with the fireteam. `g`: the difficulty band (enemy health and damage grow with it).
export const DUNGEONS = {
  shadow: {
    id: 'shadow',
    name: "The Emperor's Shadow",
    kicker: 'The Leviathan  ·  Underbelly and Sanctum',
    desc: 'The Emperor you toppled was a machine. The real Calus waits deep in the Leviathan, past his baths, his gardens and his gauntlet. Earn his Favor, make your offerings, and do not make him wait.',
    unlock: { mission: 'lev1', text: 'Clear "The Emperor\'s Throne" on the Leviathan' },
    layout: 'level-shadow',
    faction: 'legion', // the base classes spawn as Cabal; the Leviathan colours (loyalist) make them Loyalists
    enemyLightOver: 20,
    g: 21,
    favorTime: 50, // Favor counts down from x50, one a second
    strikes: 3, // the third wrong offering kills
    exoticChance: 0.05, // per player, per boss and encounter clear
    segments: {
      baths: {
        kind: 'boss',
        boss: { id: 'vhorrak', name: 'Vhorrak, the Anointed', model: 'anointedBather', element: 'solar', hpMult: 1, melee: true, scale: 0.8, radius: 1.1, speed: 4.2, meleeDmg: 48, leash: 10, returnSpeed: 6, hitFrac: { cleave: 0.45, slam: 0.35, lunge: 0.3 } }, // hitFrac: each hit takes this share of the target's health plus shield, so no single hit kills from full (Bryce) // leash: outside a DPS window he guards this radius around his spawn (Bryce); in a window he chases // a melee boss: two cleavers, no ranged attacks; about 3.7 m tall (model 4.6 m x 0.8)
        stepsBy: [3, 4, 5], // offering steps per round for 1, 2, 3 players
        shuffleFrom: 2, // from this round on the plates shuffle their sigils after every window
        windowTime: 14, // seconds of DPS
        censerHits: 8, // shots to break a censer
        corruptAfter: 18, // seconds a Bather may stand in a pool before it corrupts it
        tasterEvery: 16, // a new Royal Taster when none is alive, at most this often
        waves: [[['grunt', 4], ['lg_phalanx', 2]], [['grunt', 3], ['lg_psion', 2], ['captain', 1]]],
        bathers: [['lg_bather', 1]], // one per pool, on a timer
        bathEvery: 22,
        wrongWave: [['grunt', 2], ['lg_psion', 1]],
        windowAdds: [['grunt', 2], ['lg_phalanx', 1]],
        cleaveEvery: 4.2, slamEvery: 11, slamRadius: 9, burnDps: 18,
      },
    },
  },
};
/** The five base classes spawn as the location's own faction (Loyalist Cabal on the Leviathan). */
/** Where a leashed boss may stand this frame: inside `leash` of home, or anywhere while it chases (DPS). Returns the corrected x, z. */
export function leashStep(x, z, home, leash, chasing, returnSpeed, dt) {
  if (chasing) return [x, z];
  const dx = x - home[0], dz = z - home[2], d = Math.hypot(dx, dz);
  if (d <= leash) return [x, z];
  const back = Math.min(d - leash, returnSpeed * dt); // walk back toward the edge of his area, never teleport
  return [x - (dx / d) * back, z - (dz / d) * back];
}
/** A capped boss hit: the raw damage after Light and fireteam multipliers, never more than `frac` of the target's health plus shield. */
export const cappedHit = (raw, pool, frac) => Math.min(raw, pool * frac);
export const BASE_TYPES = ['grunt', 'rusher', 'captain', 'heavy'];
export const dungeonList = () => Object.values(DUNGEONS);
export function dungeonDef(id) {
  const d = DUNGEONS[id];
  if (!d) throw new Error(`Unknown dungeon "${id}"`);
  return d;
}

/** Checks a registry entry (the tests run it): every unit exists and the numbers are sane. Returns a list of problems. */
export function validateDungeon(d) {
  const bad = [];
  const need = (c, m) => { if (!c) bad.push(m); };
  need(d.id && d.name && d.layout && d.unlock?.mission, 'id, name, layout and unlock.mission are required');
  need(d.enemyLightOver >= 0 && d.g >= 0 && d.favorTime > 0 && d.strikes >= 1, 'enemyLightOver, g, favorTime and strikes');
  need(d.exoticChance > 0 && d.exoticChance < 1, 'exoticChance');
  for (const [id, c] of Object.entries(d.segments || {})) {
    const kits = [...(c.waves || []).flat(), ...(c.bathers || []), ...(c.wrongWave || []), ...(c.windowAdds || [])];
    for (const [t, n] of kits) { need(UNITS[t] || BASE_TYPES.includes(t), `${id}: unknown unit ${t}`); need(n >= 1, `${id}: bad count for ${t}`); }
    if (c.kind === 'boss') need(c.boss?.name && c.boss.model && c.windowTime > 0, `${id}: boss`);
    if (c.stepsBy) need(c.stepsBy.length === 3 && c.stepsBy.every((n, i) => n >= 1 && (i === 0 || n >= c.stepsBy[i - 1])), `${id}: stepsBy`);
  }
  return bad;
}

// ---------------------------------------------------------------------------
// Unlock and records
// ---------------------------------------------------------------------------
/** A Guardian who has cleared the dungeon's campaign mission may enter, at any level. */
export const dungeonUnlocked = (s, d) => !!s?.cleared?.[d.unlock.mission];
export const dungeonLockText = (d) => d.unlock.text;
export const dungeonEnemyLight = (combat, d) => combat + d.enemyLightOver;
/** Save v14: per Guardian `dungeons: { shadow: { clears, bestTime } }`. */
export const newDungeons = () => ({ shadow: { clears: 0, bestTime: null } });
export function dungeonRecord(s, id) {
  s.dungeons ||= {};
  return (s.dungeons[id] ||= { clears: 0, bestTime: null });
}
export function recordDungeonClear(s, id, seconds) {
  const r = dungeonRecord(s, id);
  const first = r.clears === 0;
  const newBest = r.bestTime == null || seconds < r.bestTime;
  r.clears++;
  if (newBest) r.bestTime = Math.round(seconds * 10) / 10;
  return { first, record: r, newBest };
}

// ---------------------------------------------------------------------------
// Scaling
// ---------------------------------------------------------------------------
const ft = (n) => Math.max(1, Math.min(3, Math.round(n) || 1));
/** Offering steps a round needs for this fireteam size. */
export const offeringSteps = (cfg, fireteam) => cfg.stepsBy[ft(fireteam) - 1];
export const scaledCount = (n, fireteam) => Math.max(1, Math.round(n * fireteamScale(fireteam).count));
export function expandKit(kit, fireteam) {
  const out = [];
  for (const [t, n] of kit) for (let i = 0; i < scaledCount(n, fireteam); i++) out.push(t);
  return out;
}

// ---------------------------------------------------------------------------
// Favor: x50 counting down, one per second. A new chalice sets it back to full; it never stacks past the full count.
// ---------------------------------------------------------------------------
export const favorLeft = (t) => Math.max(0, Math.ceil(t));
export const favorStep = (t, dt) => Math.max(0, t - Math.max(0, dt));

// ---------------------------------------------------------------------------
// Offerings. A round is an order of sigils (the board) and which sigil each plate carries. Plates hold the four sigils in
// some order; from `shuffleFrom` on the order changes after every DPS window, so you need Favor to read them.
// ---------------------------------------------------------------------------
export function shuffled(list, rnd = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** A board order of `steps` sigils, never the same sigil twice in a row (you'd stand still). */
export function makeOrder(steps, rnd = Math.random) {
  const out = [];
  while (out.length < steps) {
    const s = SIGILS[Math.floor(rnd() * SIGILS.length)];
    if (s !== out[out.length - 1]) out.push(s);
  }
  return out;
}
/** round: { order, progress, solved }; strikes: { [playerKey]: n } kept by the encounter. */
export function newRound(steps, rnd = Math.random) { return { order: makeOrder(steps, rnd), progress: 0, solved: false }; }
/**
 * One offering. Returns 'ignored' (round already solved), 'right', 'solved' (the last step), 'wrong' (a strike, under the limit)
 * or 'lethal' (the strike that reaches the limit: that player dies). A wrong offering does not reset the board's progress.
 * A solved round clears every player's strikes.
 */
export function offer(round, strikes, who, sigil, limit = 3) {
  if (round.solved) return 'ignored';
  if (round.order[round.progress] === sigil) {
    round.progress++;
    if (round.progress >= round.order.length) { round.solved = true; for (const k of Object.keys(strikes)) delete strikes[k]; return 'solved'; }
    return 'right';
  }
  strikes[who] = (strikes[who] || 0) + 1;
  if (strikes[who] >= limit) { strikes[who] = 0; return 'lethal'; } // the counter starts over after the death
  return 'wrong';
}

// ---------------------------------------------------------------------------
// The DPS boss: immune until the mechanic opens a window, then `windowTime` seconds of damage. No damage gates.
// Final bosses (`enrage`): after `enrage.after` DPS phases the next window is announced as the last (the warning), the boss
// enrages when it ends, and at the end of the DPS phase after that it goes into final stand whatever its health.
// Final stand also starts when health falls to `finalFrac` of the maximum: a long wind-up (`finalWind` seconds) that wipes
// the fireteam if the boss is still alive when it completes. During final stand the boss takes damage.
// ---------------------------------------------------------------------------
export class DpsBossFsm {
  constructor(cfg) {
    this.cfg = cfg;
    this.mode = 'immune'; // immune | window | final | dead
    this.phases = 0; // DPS phases started
    this.windowLeft = 0;
    this.enraged = false;
    this.warned = false;
    this.finalLeft = 0;
  }
  get immune() { return this.mode === 'immune'; }
  /** The mechanic is done: open a DPS window. Returns the events this causes. */
  openWindow() {
    if (this.mode !== 'immune') return [];
    this.mode = 'window';
    this.windowLeft = this.cfg.windowTime;
    this.phases++;
    const ev = ['window'];
    const E = this.cfg.enrage;
    if (E && !this.warned && this.phases >= E.after) { this.warned = true; ev.push('enrage-warning'); }
    return ev;
  }
  /** Per frame. Returns a list of events: window-end, enraged, final, final-wipe, dead. */
  tick(dt, hp, maxHp) {
    const ev = [];
    if (this.mode === 'dead') return ev;
    if (hp <= 0) { this.mode = 'dead'; ev.push('dead'); return ev; }
    const E = this.cfg.enrage;
    if (E && this.mode !== 'final' && hp <= maxHp * E.finalFrac) { this.startFinal(); ev.push('final'); return ev; }
    if (this.mode === 'window') {
      this.windowLeft -= dt;
      if (this.windowLeft <= 0) {
        if (E && this.enraged) { this.startFinal(); ev.push('final'); return ev; }
        this.mode = 'immune';
        ev.push('window-end');
        if (E && this.warned && !this.enraged) { this.enraged = true; ev.push('enraged'); }
      }
    } else if (this.mode === 'final') {
      this.finalLeft -= dt;
      if (this.finalLeft <= 0) { this.finalLeft = 0; ev.push('final-wipe'); }
    }
    return ev;
  }
  startFinal() { this.mode = 'final'; this.finalLeft = this.cfg.enrage.finalWind; }
  /** After a wipe the encounter resets: a fresh machine. */
  reset() { Object.assign(this, new DpsBossFsm(this.cfg)); }
}

// ---------------------------------------------------------------------------
// Loot: one item from the dungeon pool per player per boss or encounter clear, and a 5% exotic chance on top.
// The first full clear also guarantees the shader. Weapons and armor split evenly.
// ---------------------------------------------------------------------------
export function clearDrops(d, { finalClear = false, firstClear = false, ownsShader = false } = {}, rnd = Math.random) {
  const out = [{ kind: rnd() < 0.5 ? 'weapon' : 'armor' }];
  if (rnd() < d.exoticChance) out.push({ kind: 'exotic' });
  if (finalClear && firstClear && !ownsShader) out.push({ kind: 'shader' });
  return out;
}

// Respawns: the same restricted rules as exotic missions (exotic-rules.js deathOutcome / wipeOutcome), but a dungeon resets
// the whole encounter. Re-exported so the dungeon runtime reads one module.
export { deathOutcome, wipeOutcome, isWipe, trackSafe, inVoid, inRegion, RESPAWN_DELAY } from './exotic-rules.js';
