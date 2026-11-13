// U21b: the class-jump reach model. A time-stepped copy of the air movement in js/player.js (updateMovement), so a level can check what
// every standard class jump can cover. Pure (no Three.js, no DOM): tools/tests.js and js/level-whisper.js use it.
//
// Inputs are the best a player can do: sprint (hold forward and Shift, in the air too), jump at the lip, and fire every air jump or
// all the fuel at the best moment (the moment is searched over a grid). Blink and the Strand grapple are NOT modelled (Bryce: they skip it).
// Numbers come from js/subclass.js JUMP_TUNE, js/armor.js speedMult / jumpBonus and player.js (gravity 24, walk 6.2, jump 8.2, sprint x1.5).
import { JUMP_TUNE } from './subclass.js';
import { speedMult, jumpBonus } from './armor.js';

export const GRAV = 24, WALK = 6.2, JUMP0 = 8.2, SPRINT = 1.5, BODY_R = 0.4;
export const REACH_MOBILITY = 50; // a full legendary set; Mobility 100 and exotics (Stompees) are deliberately not modelled
/** The standard class jumps this model covers, by player.js jump id. */
export const REACH_MODES = ['base', 'lift', 'highlift', 'strafelift', 'highjump', 'strafejump', 'double', 'glide', 'balanced', 'strafeglide'];

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const STEP = 1 / 60; // the game steps at the display rate; 60 Hz is the usual case

/**
 * One flight as the model runs it. `mode`: a jump id. `t1`, `t2`: when (seconds after take-off) the air jump / lift / glide starts
 * (t2 is the Hunter's second air jump). Returns { dt, xy }: xy is a Float32Array of interleaved samples (x = distance along the
 * run, y = height above the take-off floor), one per `dt`, starting at take-off.
 */
export function flight(mode, t1 = 0, t2 = 0, mob = REACH_MOBILITY, sprint = true, tMax = 6, step = STEP) {
  const jumpV = JUMP0 + jumpBonus(mob), speed = WALK * speedMult(mob) * (sprint ? SPRINT : 1);
  const JT = JUMP_TUNE[mode] || {};
  const accel = JT.air ?? 2.5, DT = step;
  let x = 0, y = 0, vx = speed, vy = jumpV, t = 0, fuel = 1, jumps = 0, used = false;
  const n = Math.ceil(tMax / DT) + 1, xy = new Float32Array(n * 2);
  let i = 1;
  while (t < tMax && i < n) {
    vx = damp(vx, speed, accel, DT);
    vy -= GRAV * DT;
    const press1 = t >= t1, press2 = t >= t2;
    if (mode === 'double') {
      if (jumps < 1 && press1) { jumps = 1; vy = jumpV * 0.95; vx += 3; }
      else if (jumps === 1 && press2 && t >= t1 + 0.1) { jumps = 2; vy = jumpV * 0.85; vx += 3; }
    } else if (mode === 'highjump' || mode === 'strafejump') {
      if (jumps < 1 && press1) { jumps = 1; vy = jumpV * JT.v; vx += 3; }
    } else if (mode === 'lift' || mode === 'highlift' || mode === 'strafelift') {
      if (press1 && fuel > 0 && vy < 1.5) { vy = Math.min(JT.max, vy + 40 * DT); fuel = Math.max(0, fuel - DT / JT.fuel); }
    } else if (JT.burst) {
      if (!used && press1) { used = true; fuel = 1; vy = Math.max(vy, JT.burst); vx += 2; }
      if (used && fuel > 0 && vy < 1.2) {
        vy = damp(vy, fuel > 0.6 ? 1.0 : -0.7, 6, DT);
        vx = damp(vx, speed * JT.speed, JT.steer, DT);
        fuel = Math.max(0, fuel - DT / JT.fuel);
      }
    }
    x += vx * DT; y += vy * DT; t += DT;
    xy[i * 2] = x; xy[i * 2 + 1] = y; i++;
    if (y < -70) break;
  }
  return { dt: DT, xy, n: i };
}
/** The same flight as an array of [t, x, y] samples (for tools). */
export function flightPath(mode, t1 = 0, t2 = 0, mob = REACH_MOBILITY, sprint = true) {
  const f = flight(mode, t1, t2, mob, sprint);
  return Array.from({ length: f.n }, (_, k) => [k * f.dt, f.xy[k * 2], f.xy[k * 2 + 1]]);
}

/** From a path: the horizontal distance at the last downward crossing of height `rise` (0 when the jump never gets that high). */
function crossing(f, rise) {
  let best = 0;
  for (let k = 1; k < f.n; k++) {
    const y0 = f.xy[(k - 1) * 2 + 1], y1 = f.xy[k * 2 + 1];
    if (y0 >= rise && y1 < rise) {
      const fr = (y0 - rise) / (y0 - y1 || 1), x0 = f.xy[(k - 1) * 2], x1 = f.xy[k * 2];
      best = Math.max(best, x0 + (x1 - x0) * fr);
    }
  }
  return best;
}
function apex(f) { let m = 0; for (let k = 0; k < f.n; k++) m = Math.max(m, f.xy[k * 2 + 1]); return m; }

const grid = (n, step) => Array.from({ length: n }, (_, i) => i * step);
const T1 = grid(40, 0.05), T2 = grid(20, 0.1);
const _cache = new Map();
/** Every candidate flight for a mode (the search grid), cached. */
function candidates(mode, mob, sprint) {
  const key = `${mode}|${mob}|${sprint}`;
  if (_cache.has(key)) return _cache.get(key);
  const out = [];
  if (mode === 'base') out.push(flight('base', 0, 0, mob, sprint));
  else if (mode === 'double') { for (const a of T1) for (const b of T2) if (b >= a + 0.1) out.push(flight(mode, a, b, mob, sprint)); }
  else { for (const a of T1) out.push(flight(mode, a, 0, mob, sprint)); }
  _cache.set(key, out);
  return out;
}

/** Farthest distance (m) this jump covers while landing `rise` metres above (negative: below) its take-off floor. 0 when it cannot get that high. */
export function reachOf(mode, rise = 0, mob = REACH_MOBILITY, sprint = true) {
  let best = 0;
  for (const f of candidates(mode, mob, sprint)) best = Math.max(best, crossing(f, rise));
  return best;
}
/** The highest floor (m above the take-off) this jump can land on. */
export function riseOf(mode, mob = REACH_MOBILITY, sprint = true) {
  let best = 0;
  for (const f of candidates(mode, mob, sprint)) best = Math.max(best, apex(f));
  return best;
}
/** The best of every standard class jump for a rise: { reach, mode }. */
export function bestReach(rise = 0, mob = REACH_MOBILITY, sprint = true) {
  let best = { reach: 0, mode: 'base' };
  for (const m of REACH_MODES) { const r = reachOf(m, rise, mob, sprint); if (r > best.reach) best = { reach: r, mode: m }; }
  return best;
}
/** The highest rise any class jump can make (the real climb limit; a phase rise above this plus a margin cannot be skipped). */
export function bestRise(mob = REACH_MOBILITY, sprint = true) {
  return REACH_MODES.reduce((m, id) => Math.max(m, riseOf(id, mob, sprint)), 0);
}

/** Margin kept over a class jump: the body radius twice (a jump lands its centre on the ledge) and 1.5 m of safety. */
export const REACH_MARGIN = 2 * BODY_R + 1.5;
/** Safety kept over the highest climb, in metres. */
export const RISE_MARGIN = 0.5;
const _tab = new Map();
/** Best reach for a rise from a cached table (0.5 m steps, rounded toward the longer jump), for the route graph. */
export function reachTable(rise, mob = REACH_MOBILITY, sprint = true) {
  const key = `${mob}|${sprint}`;
  let t = _tab.get(key);
  if (!t) { t = { top: bestRise(mob, sprint), r: new Map() }; _tab.set(key, t); }
  const lim = t.top + RISE_MARGIN;
  if (rise > lim) return null; // no class jump gets up that high: unreachable
  const g = Math.floor(Math.min(rise, t.top - 0.05) * 2) / 2;
  if (!t.r.has(g)) t.r.set(g, bestReach(g, mob, sprint).reach);
  return t.r.get(g);
}
