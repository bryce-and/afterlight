// U21 "The Whisper": the exotic mission map (static geometry only). Five Vex caverns deep under Io, one linear path:
// The Descent (encounter), The Red Shaft (climb), Blight Gallery (encounter), The Green Chasm (descent), The Falls (boss).
// Interactive things (conduits, eyes, phase blocks, movers, glyphs, blights, gates) are built by js/exotic-missions.js and js/mechanics.js from
// WHISPER_LAYOUT; this file builds terrain, walls, ceilings, footholds, decor, lights and the per-segment fog.
//
// HOW THE FLOOR WORKS. Every walkable surface is TERRAIN (js/terrain.js plateaus and ramps), so ground height, enemy nav, spawn heights
// and the nav "abyss" all work as on the Tangled Shore. Between the footholds the ground is 0, and `voidBelow: 1` makes ground under 1 m
// a void: no floor, you fall (WHISPER_LAYOUT.voidY = -40 is where a fall is called). The terrain mesh is removed in build(); each foothold
// is drawn as a slab, a floating Vex fragment ("rock": a plateau drawn as a hanging rock, nothing solid under it), a broken pillar or a
// wall shelf, always matching its plateau exactly. Walls, ceilings and cover are solid boxes at ABSOLUTE heights.
// Terrain is single valued, so no static foothold may sit over another. Phase blocks are NOT terrain (solid boxes while Attuned), so they
// may pass over or under footholds with clearance; checkWhisperRoute() checks that.
//
// THE TRAVERSALS (U21b). The Red Shaft climbs 24.8 m in four stages and The Green Chasm drops 12 m in two. A STAGE is a group of static
// footholds at one height (a "comp") plus a chain of phase blocks to the next one. A class jump cannot skip a stage:
//   climb  : the next stage is 6.2 m higher, more than any class jump rises (js/jump-reach.js: about 5.1 m for Lift at Mobility 50, sprinting,
//            plus a 0.5 m margin), so only the blocks get you up.
//   descent: the next stage is farther than the best glide at Mobility 50 (about 47 m for a 6 m drop, 57 m for 12 m) plus 2.3 m.
// checkWhisperRoute() proves it: it joins all static footholds with the base-jump links AND every class-jump reach (js/jump-reach.js: lift,
// highlift, strafelift, highjump, strafejump, Hunter triple jump, the three glides; sprinting in the air; blink and the Strand grapple excluded)
// and reports a problem if the start can still reach the exit without a phase block.
//
// BASE JUMP LIMITS (js/player.js and js/armor.js, no air jump): gravity 24 m/s^2, jump velocity 8.2 m/s (jumpV = 8.2 + 0.0125 * Mobility),
// walk 6.2 m/s (sprint x1.5 = 9.3, only forward), body radius 0.4.
//   max rise      = 8.2^2 / (2 * 24)                        = 1.40 m   (design limit 0.9 m, 64 percent)
//   max flat gap  = 6.2 * 2 * 8.2 / 24                      = 4.24 m walking (design limit 70 percent: 2.97 m flat)
//   gap at rise r = 6.2 * (8.2 + sqrt(8.2^2 - 48 r)) / 24   (rise +0.78: 3.53 m, limit 2.47; drop -2.0: 5.42 m, limit 3.8)
//   every intended hop is at most 70 percent of the walking figure for its own rise or drop, so it needs no sprint. The player can step up
//   0.6 m (stairs) and walk ramps up to slope 0.55 (these use 0.45). checkWhisperRoute() re-checks every hop and prints the margin.
import * as THREE from 'three';
import { blightOrb } from './blight-look.js';
import { moverSafe, EYE_SYM, boardWidth, boardYaw } from './exotic-rules.js';
import { reachTable, bestReach, bestRise, riseOf, reachOf, REACH_MODES, REACH_MOBILITY, REACH_MARGIN, RISE_MARGIN } from './jump-reach.js';
export { REACH_MODES, REACH_MOBILITY, reachOf, riseOf, bestReach, bestRise, reachTable, REACH_MARGIN, RISE_MARGIN };

export const WHISPER_JUMP = { v: 8.2, g: 24, walk: 6.2, sprint: 9.3, step: 0.6, r: 0.4 };
/** Farthest horizontal distance a base jump can cover when it ends `rise` metres above (negative: below) where it started. */
export const maxGap = (rise, speed = WHISPER_JUMP.walk, v = WHISPER_JUMP.v) => {
  const d = v * v - 2 * WHISPER_JUMP.g * rise;
  return d < 0 ? 0 : (speed * (v + Math.sqrt(d))) / WHISPER_JUMP.g;
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------------------------------------------------------------
const BRONZE = 0xb08a46, BRONZE2 = 0x6e4c2a, BRONZE3 = 0x4a3320, MILK = 0xeef2ff, RED = 0xff2a22, TEALG = 0x5ad8d0, AMBER = 0xffa83a;
const D_WALL = 0x5a4630, D_FLOOR = 0x4a3a28;                       // Descent: dim bronze
const S_WALL = 0x4e1c1c, S_RIB = 0x7a2a24, S_FLOOR = 0x6a2e26, S_GLOW = 0xff3a24; // Red Shaft
const G_WALL = 0x15151b, G_FLOOR = 0x1c1c24, G_WHITE = 0xe6e6f0, G_BLUE = 0xbcd4ff, G_BLIGHT = 0x050609; // Blight Gallery
const C_WALL = 0x2a4a52, C_WALL2 = 0x356068, C_LEDGE = 0x3d6a70, C_MOSS = 0x4f7a22, C_LIGHT = 0xbff4ff; // Green Chasm
const F_WALL = 0x30241a, F_RIB = 0x5a4026, F_FLOOR = 0x7a4a2a, F_GRASS = 0xb88a3a, F_GOLD = 0xffc860, F_WATER = 0xfff6dc; // The Falls

// ---------------------------------------------------------------------------------------------------------------------------------
// Data: footholds, ramps, hops, chains (pure, so the route can be checked without building anything)
// ---------------------------------------------------------------------------------------------------------------------------------
const PL = new Map();   // id -> { id, x0, x1, z0, z1, top, kind: 'floor' | 'ledge' | 'shelf' | 'rock' | 'pillar' | 'block', seg, dead, secret }
const RAMPS = [];       // { id, from, to, x0, z0, x1, z1, w }
const HOPS = [];        // [from, to, kind]: 'jump' (two way), 'drop' (one way), 'phase' (a jump onto / between phase blocks), 'walk' (flush)
const CHAINS = [];      // { id, seg, from, to, blocks: [ids] }: a run of phase blocks between two static footholds
const REST = [];        // ids of rest blocks (bigger phase blocks that carry a conduit)
const plat = (id, seg, kind, x0, x1, z0, z1, top, o = {}) => { if (PL.has(id)) throw new Error('duplicate foothold ' + id); PL.set(id, { id, seg, kind, x0, x1, z0, z1, top, dead: !!o.dead, secret: !!o.secret }); return id; };
const hop = (a, b, kind = 'jump') => HOPS.push([a, b, kind]);
const ramp = (id, from, to, x0, z0, x1, z1, w = 3.2) => RAMPS.push({ id, from, to, x0, z0, x1, z1, w });
const r2 = (v) => Math.round(v * 100) / 100;

const YD = 10;        // Descent floor
const YG = 34.8;      // Blight Gallery floor (top of the Red Shaft)
const YB = 22.8;      // The Falls floor (bottom of the Green Chasm)
const STAGE = r2((YG - YD) / 4); // 6.2 m: more than any class jump climbs
const SH = [0, 1, 2, 3, 4].map((i) => r2(YD + STAGE * i));
const DROP = r2((YG - YB) / 2);  // 6 m per Chasm stage

// ---- Descent, tunnels and halls: big floors (terrain only; the hall builder draws them) ----
plat('d_floor', 'descent', 'floor', -1, 57, -23, 23, YD);
plat('t1_floor', 'descent', 'floor', 56.5, 76.5, -3, 3, YD);
plat('t2_floor', 'shaft', 'floor', 105.5, 122, -20.6, -17.4, YG);
plat('g_floor', 'gallery', 'floor', 121, 181, -27, 27, YG);
plat('t3_floor', 'gallery', 'floor', 180.5, 199, -3, 3, YG);
plat('t4_floor', 'chasm', 'floor', 290.5, 311, -3, 3, YB);
plat('f_floor', 'falls', 'floor', 309, 381, -31, 31, YB);

// ---- phase chains ----
const GAP = 2.4, BLK = 3.0, PITCH = GAP + BLK; // a 2.4 m gap, under the 70 percent design limit at a +0.78 rise
const DIRS = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] };
/**
 * A run of phase blocks from static foothold `from`: `steps` is [[dir, count], ...] (dir '+x' '-x' '+z' '-z'); `lat` the centre of the first block across the
 * first direction. The tops climb (or fall) evenly from the foothold to `topEnd` over the blocks and the pad after them (the first `flat` blocks stay level);
 * `big` maps a block index to a bigger size (rest blocks). With `o.endAt` the last block is itself the end (a side path: no pad). Returns what endPad needs.
 */
function chain(id, seg, from, steps, lat, topEnd, o = {}) {
  const F = PL.get(from), seq = [];
  for (const [d, n] of steps) for (let i = 0; i < n; i++) seq.push(d);
  const n = seq.length, d0 = DIRS[seq[0]], ids = [], flat = o.flat ?? 0, span = o.endAt ? n - flat : n - flat + 1;
  let cx, cz;
  if (d0[0]) { cx = (d0[0] > 0 ? F.x1 : F.x0) + d0[0] * (GAP + BLK / 2); cz = lat; }
  else { cz = (d0[1] > 0 ? F.z1 : F.z0) + d0[1] * (GAP + BLK / 2); cx = lat; }
  let prev = from;
  for (let k = 0; k < n; k++) {
    if (k > 0) { cx += DIRS[seq[k]][0] * PITCH; cz += DIRS[seq[k]][1] * PITCH; }
    const sz = o.big?.[k] ?? BLK, top = k < flat ? F.top : r2(F.top + ((topEnd - F.top) * (k - flat + 1)) / span), bid = `${id}${k}`;
    plat(bid, seg, 'block', cx - sz / 2, cx + sz / 2, cz - sz / 2, cz + sz / 2, top, { secret: !!o.secret });
    if (o.big?.[k]) REST.push(bid);
    hop(prev, bid, 'phase'); prev = bid; ids.push(bid);
  }
  return { id, seg, from, ids, dir: seq[n - 1], last: PL.get(prev), topEnd };
}
/** The static foothold a chain ends on: `w0`..`w1` across the last direction, `depth` along it, adjacent to the last block. */
function endPad(id, kind, ch, w0, w1, depth, o = {}) {
  const L = ch.last, d = DIRS[ch.dir];
  let x0, x1, z0, z1;
  if (d[0]) { x0 = d[0] > 0 ? L.x1 + GAP : L.x0 - GAP - depth; x1 = x0 + depth; z0 = w0; z1 = w1; }
  else { z0 = d[1] > 0 ? L.z1 + GAP : L.z0 - GAP - depth; z1 = z0 + depth; x0 = w0; x1 = w1; }
  plat(id, ch.seg, kind, r2(x0), r2(x1), r2(z0), r2(z1), ch.topEnd, o);
  hop(L.id, id, 'phase');
  CHAINS.push({ id: ch.id, seg: ch.seg, from: ch.from, to: id, blocks: ch.ids });
  return id;
}

// ---- The Red Shaft: four stages, a zigzag up four lanes (x 79.5, 86.5, 94.5, 102.5), the hall runs z -21.5 .. 78 ----
// stage 1 (y 10): the tunnel mouth. Stage 2 (y 16.2): north end, west. Stage 3 (y 22.4): south, middle. Stage 4 (y 28.6): north end, east. Stage 5 (y 34.8): the exit.
plat('sh_p0', 'shaft', 'ledge', 75.5, 83, -3, 9, SH[0]);
plat('sh_dd', 'shaft', 'rock', 85.6, 89.4, -2, 1.8, SH[0], { dead: true });
hop('sh_p0', 'sh_dd');
const shA = chain('sh_a', 'shaft', 'sh_p0', [['+z', 7]], 79.5, SH[1]);
endPad('sh_c2a', 'shelf', shA, 76, 83, 7.8);
plat('sh_c2p', 'shaft', 'pillar', 85.6, 88.4, 50.4, 53.2, SH[1]);
hop('sh_c2a', 'sh_c2p');
const shB = chain('sh_b', 'shaft', 'sh_c2p', [['-z', 7]], 86.5, SH[2]);
endPad('sh_c3a', 'ledge', shB, 83.5, 90, 7.8);
plat('sh_c3b', 'shaft', 'rock', 92.5, 96.5, 3, 7, SH[2]);
hop('sh_c3a', 'sh_c3b');
plat('sh_c3c', 'shaft', 'pillar', 98.4, 101, 3.4, 6, SH[2], { dead: true });
hop('sh_c3b', 'sh_c3c');
const shC = chain('sh_c', 'shaft', 'sh_c3b', [['+z', 7]], 94.5, SH[3]);
endPad('sh_c4a', 'rock', shC, 91, 98, 7.8);
plat('sh_c4s', 'shaft', 'shelf', 100.2, 105.8, 49.8, 52.6, SH[3]);
hop('sh_c4a', 'sh_c4s');
const shD = chain('sh_d', 'shaft', 'sh_c4s', [['-z', 12]], 102.5, SH[4], { flat: 3, big: { 6: 4.6 } });
endPad('sh_e5', 'ledge', shD, 96.5, 106, 3.2);
// the hidden side path off stage 2: three blocks north to a rest block that holds the cache (revealed by three hidden eyes)
const shS = chain('sh_s', 'shaft', 'sh_c2a', [['+z', 3]], 79.5, SH[1] + 1.2, { endAt: true, secret: true, big: { 2: 4.6 } });
CHAINS.push({ id: 'sh_s', seg: 'shaft', from: 'sh_c2a', to: shS.ids[2], blocks: shS.ids, secret: true });

// ---- The Green Chasm: a vast canyon, two long stages (y 34.8 -> 28.8 -> 22.8), the hall runs x 198..292, z -16..70 ----
// the glide at Mobility 50 covers about 47 m of a 6 m drop (57 m of 12 m), so the stages are 49 m and 60 m apart
plat('ch_c0', 'chasm', 'ledge', 198, 206, -4, 10, YG);
plat('ch_s1', 'chasm', 'shelf', 198, 204.4, -10, -6.4, YG, { dead: true });
plat('ch_c1', 'chasm', 'rock', 208.4, 212.4, -2, 2, YG);
hop('ch_c0', 'ch_s1'); hop('ch_c0', 'ch_c1');
const chA = chain('ch_a', 'chasm', 'ch_c0', [['+z', 9], ['+x', 6]], 202, YG - DROP, { big: { 6: 4.6, 12: 4.6 } });
endPad('ch_c2a', 'ledge', chA, 53, 62, 8.8);
plat('ch_c2b', 'chasm', 'rock', 249.8, 253.8, 56, 60, YG - DROP);
plat('ch_c2c', 'chasm', 'pillar', 256.4, 259.2, 56.4, 59.2, YG - DROP);
plat('ch_c2d', 'chasm', 'ledge', 261.8, 268.2, 55, 64, YG - DROP);
hop('ch_c2a', 'ch_c2b'); hop('ch_c2b', 'ch_c2c'); hop('ch_c2c', 'ch_c2d');
const chB = chain('ch_b', 'chasm', 'ch_c2d', [['-z', 5], ['+x', 3], ['-z', 4]], 265, YB, { big: { 5: 4.6 } });
endPad('ch_c3a', 'ledge', chB, 277.5, 284.5, 8);
plat('ch_exit', 'chasm', 'ledge', 286.9, 291.4, -4, 6, YB);
hop('ch_c3a', 'ch_exit');

/** Per traversal: the hall bounds, where you start and where you must get to. */
export const HALLS = {
  shaft: { x0: 76, x1: 106, z0: -21.5, z1: 78, start: 'sh_p0', goal: 'sh_e5' },
  chasm: { x0: 198, x1: 292, z0: -16, z1: 70, start: 'ch_c0', goal: 'ch_exit' },
};

/** The raw route data, for tools and the in-browser jump test. */
export const WHISPER_DATA = { PL, RAMPS, HOPS, CHAINS, REST, HALLS, SH, STAGE };

/** Rectangle distance in the ground plane. */
const rectGap = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.z0 - b.z1, b.z0 - a.z1));
const overlap2d = (a, b, pad = 0) => a.x0 < b.x1 - pad && b.x0 < a.x1 - pad && a.z0 < b.z1 - pad && b.z0 < a.z1 - pad;
const MAXRISE = 0.9, FRAC = 0.7;
const hopOk = (A, B, frac = FRAC) => { const rise = B.top - A.top, gap = rectGap(A, B); return rise <= MAXRISE && gap <= frac * maxGap(rise) + 1e-9; };

/**
 * Checks the whole route. `{ sprint }` (default true: Shift held in the air too) picks the class-jump model at Mobility 50 (js/jump-reach.js).
 * What it proves, as problems:
 *   - every intended hop (static and phase) is makeable with the BASE jump (70 percent of the walking max), both ways unless a one way drop;
 *   - ramps are flush and walkable;
 *   - no class jump (lift, highlift, strafelift, highjump, strafejump, triple jump, glide, balanced glide, strafe glide) can get from a traversal's start
 *     to its exit through static footholds alone: the graph of base links plus every class reach (plus 2.3 m) must not join them. Each chain is also
 *     reported on its own (rise, void, best class jump);
 *   - static footholds never overlap in plan, phase blocks keep 4.2 m of clearance over / under anything they cross in plan, everything is inside its hall.
 * Returns { problems, rows }.
 */
export function checkWhisperRoute(opts = {}) {
  const sprint = opts.sprint ?? true, problems = [], rows = [];
  for (const [a, b, kind] of HOPS) {
    const A = PL.get(a), B = PL.get(b), rise = B.top - A.top, gap = rectGap(A, B), lim = maxGap(rise);
    rows.push(`${a} -> ${b} ${kind}: gap ${gap.toFixed(2)} m, rise ${rise.toFixed(2)} m, ${(100 * gap / lim).toFixed(0)} percent of the walking max (${lim.toFixed(2)} m)`);
    if (!hopOk(A, B)) problems.push(`${a} -> ${b} is too hard (gap ${gap.toFixed(2)}, rise ${rise.toFixed(2)})`);
    if (kind !== 'drop' && !hopOk(B, A)) problems.push(`${b} -> ${a} (the way back) is too hard`);
    if (kind === 'drop' && rise >= 0) problems.push(`${a} -> ${b} should be a drop`);
  }
  for (const r of RAMPS) { // ramps: flush at both ends and walkable
    const A = PL.get(r.from), B = PL.get(r.to), len = Math.hypot(r.x1 - r.x0, r.z1 - r.z0), slope = (B.top - A.top) / len;
    rows.push(`ramp ${r.id}: rise ${(B.top - A.top).toFixed(2)} over ${len.toFixed(1)} m, slope ${slope.toFixed(3)}`);
    if (slope > 0.5) problems.push(`ramp ${r.id} slope ${slope.toFixed(2)} is steeper than 0.5`);
    const edge = (P, x, z) => x >= P.x0 - 0.3 && x <= P.x1 + 0.3 && z >= P.z0 - 0.3 && z <= P.z1 + 0.3;
    if (!edge(A, r.x0, r.z0)) problems.push(`ramp ${r.id} does not start on ${r.from}`);
    if (!edge(B, r.x1, r.z1)) problems.push(`ramp ${r.id} does not end on ${r.to}`);
  }
  // ---- class jumps: every chain on its own, then the whole static graph of each traversal ----
  const top = bestRise(REACH_MOBILITY, sprint);
  rows.push(`class jumps at Mobility ${REACH_MOBILITY}, sprint ${sprint}: highest climb ${top.toFixed(2)} m, margin ${RISE_MARGIN} m rise / ${REACH_MARGIN.toFixed(1)} m distance`);
  for (const c of CHAINS) {
    if (c.secret) continue;
    const A = PL.get(c.from), B = PL.get(c.to), rise = B.top - A.top, gap = rectGap(A, B), reach = reachTable(rise, REACH_MOBILITY, sprint);
    rows.push(`chain ${c.id} (${c.blocks.length} blocks) ${c.from} -> ${c.to}: rise ${rise.toFixed(2)} m, void ${gap.toFixed(1)} m, ` + (reach === null ? `no class jump climbs ${rise.toFixed(1)} m (best ${top.toFixed(2)})` : `best class jump ${reach.toFixed(1)} m`));
  }
  for (const [seg, H] of Object.entries(HALLS)) {
    const nodes = [...PL.values()].filter((p) => p.seg === seg && p.kind !== 'block' && p.kind !== 'floor');
    const adj = new Map(nodes.map((p) => [p.id, new Map()]));
    const edge = (a, b, why) => { if (adj.has(a) && adj.has(b) && !adj.get(a).has(b)) adj.get(a).set(b, why); };
    for (const [a, b, kind] of HOPS) { if (kind === 'phase') continue; edge(a, b, 'hop'); if (kind !== 'drop') edge(b, a, 'hop'); }
    for (const r of RAMPS) { edge(r.from, r.to, 'ramp'); edge(r.to, r.from, 'ramp'); }
    let tight = Infinity, tightRow = '';
    for (const A of nodes) for (const B of nodes) {
      if (A === B) continue;
      const rise = B.top - A.top, reach = reachTable(rise, REACH_MOBILITY, sprint);
      if (reach === null) continue; // no class jump climbs that high
      const gap = rectGap(A, B), slack = gap - (reach + REACH_MARGIN);
      if (slack < 0) edge(A.id, B.id, `class jump (${gap.toFixed(1)} m of void, rise ${rise.toFixed(1)}, reach ${reach.toFixed(1)})`);
      else if (slack < tight && !adj.get(A.id).has(B.id) && (A.top !== B.top || gap > 8)) { tight = slack; tightRow = `${A.id} -> ${B.id} (void ${gap.toFixed(1)}, rise ${rise.toFixed(1)}, reach ${reach.toFixed(1)})`; }
    }
    const seen = new Map([[H.start, null]]), q = [H.start];
    while (q.length) { const a = q.shift(); for (const [b, why] of adj.get(a)) if (!seen.has(b)) { seen.set(b, [a, why]); q.push(b); } }
    if (seen.has(H.goal)) {
      const path = []; let c = H.goal;
      while (c) { const s = seen.get(c); path.unshift(c + (s ? ` (${s[1]})` : '')); c = s?.[0]; }
      problems.push(`${seg}: ${H.start} reaches ${H.goal} without a phase block: ${path.join(' <- ')}`);
    } else rows.push(`${seg}: the start reaches ${seen.size} of ${nodes.length} static footholds (all before the first phase stage); the exit is out of reach. Tightest class jump left: ${tightRow} with ${tight.toFixed(1)} m to spare`);
  }
  // ---- plan overlaps and clearances ----
  const all = [...PL.values()].filter((p) => p.kind !== 'floor' || p.seg === 'shaft' || p.seg === 'chasm');
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const A = all[i], B = all[j];
    if (A.seg !== B.seg || !overlap2d(A, B, 0.05)) continue;
    const dy = Math.abs(A.top - B.top);
    if (A.kind !== 'block' && B.kind !== 'block') { if (!(A.kind === 'floor' || B.kind === 'floor') || dy > 0.01) problems.push(`${A.id} and ${B.id} overlap in plan (terrain is single valued)`); continue; }
    if (dy < 4.2) problems.push(`${A.id} and ${B.id} overlap in plan with only ${dy.toFixed(1)} m between them (4.2 m needed)`);
  }
  for (const p of PL.values()) {
    const H = HALLS[p.seg]; if (!H || p.kind === 'floor') continue;
    if (p.x0 < H.x0 - 0.6 || p.x1 > H.x1 + 0.6 || p.z0 < H.z0 || p.z1 > H.z1) problems.push(`${p.id} sticks out of the ${p.seg} hall`);
  }
  // ---- movers: every one needs a safe window to cross ----
  for (const S of WHISPER_LAYOUT.segments) for (const m of S.movers || []) {
    const w = moverSafe(m);
    rows.push(`mover ${m.id}: safe ${w.safe.toFixed(1)} s of ${m.period} s, crossing needs ${w.need.toFixed(1)} s`);
    if (w.safe < w.need) problems.push(`mover ${m.id} has ${w.safe.toFixed(1)} s safe but a crossing needs ${w.need.toFixed(1)} s`);
  }
  return { problems, rows };
}
/** Every pair of static footholds a base jump links (never onto a phase block), as the leap links the Taken nav can use: { a: [x, y, z], b: [x, y, z], two }. */
export function whisperLeapLinks() {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v)), out = [];
  for (const [a, b, kind] of HOPS) {
    if (kind !== 'jump' && kind !== 'drop') continue;
    const A = PL.get(a), B = PL.get(b);
    if (A.kind === 'block' || B.kind === 'block') continue;
    const inset = (P, x, z) => [r2(clamp(x, P.x0 + 0.5, P.x1 - 0.5)), P.top, r2(clamp(z, P.z0 + 0.5, P.z1 - 0.5))];
    const cb = [(B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2], ca = [(A.x0 + A.x1) / 2, (A.z0 + A.z1) / 2];
    out.push({ a: inset(A, cb[0], cb[1]), b: inset(B, ca[0], ca[1]), two: kind === 'jump' });
  }
  return out;
}


// ---------------------------------------------------------------------------------------------------------------------------------
// Terrain: plateaus and ramps from the data above
// ---------------------------------------------------------------------------------------------------------------------------------
const EDGE = 0.12; // a short skirt: the foothold edge is a cliff (a landing on the skirt slides off into the void)
function terrainFeatures() {
  const out = [];
  for (const p of PL.values()) {
    if (p.kind === 'block') continue; // phase blocks are built by mechanics.js and are solid only while Attuned
    out.push({ type: 'plateau', x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2, w: p.x1 - p.x0, d: p.z1 - p.z0, h: p.top, edge: EDGE });
  }
  for (const r of RAMPS) out.push({ type: 'ramp', x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, width: r.w, h0: PL.get(r.from).top, h1: PL.get(r.to).top, edge: EDGE });
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Location (shaped like a LOCATIONS entry; not in the Director's list)
// ---------------------------------------------------------------------------------------------------------------------------------
export const WHISPER_LOC = {
  id: 'whisper', name: 'The Whisper', planetName: 'Io', faction: 'taken', theme: 'io',
  desc: 'A Vex vault under Io where the Taken have taken hold. Something here whispers.',
  fog: [14, 85], sunDir: [0.3, 1, 0.2], light: { hemi: 1.0, sun: 0.2 },
  colors: { sky: 0x1c130a, fog: 0x1c130a, hemiTop: 0xb08850, hemiBot: 0x3a2a18, sun: 0xffc880, ground: 0x3a2c1e, ground2: 0x2e231a, rock: 0x4a3a28, rock2: 0x3a2e20, wall: 0x4a3a28, metal: 0x6e4c2a, accent: 0xffa83a, crate: 0x6e4c2a, foliage: 0x6a9a2a, sea: 0x0c0a0e, enemy: 0x1a181c, enemy2: 0x07070b, eye: 0xbcd4ff },
  planetColors: { sea: false, c: [0x5a4630, 0x8a6a3a, 0x2a2a2e, 0xc8b070] }, atmo: 0xffa83a,
  skyBody: { color: 0x000000, size: 0.1, pos: [0, -900, 0] }, // not drawn in a cavern
  enemyNames: {}, zoneNames: ['The Descent', 'The Red Shaft', 'Blight Gallery', 'The Green Chasm', 'The Falls'], missions: [],
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Layout contract (see docs/U21_PROPOSAL.md). Phase block `p` is the block CENTRE, `s` its full size. Everything else: y is the floor to stand on.
// ---------------------------------------------------------------------------------------------------------------------------------
const blk = (id, sy = 0.8) => { const b = PL.get(id); return { p: [(b.x0 + b.x1) / 2, b.top - sy / 2, (b.z0 + b.z1) / 2], s: [b.x1 - b.x0, sy, b.z1 - b.z0] }; };
/** A point on a foothold or block: fx, fz are 0..1 across it; y is the floor to stand on. */
const at = (id, fx = 0.5, fz = 0.5) => { const p = PL.get(id); return [r2(p.x0 + (p.x1 - p.x0) * fx), p.top, r2(p.z0 + (p.z1 - p.z0) * fz)]; };
/** A Vex piston: tucked beside a phase block, it slams across it in the direction it fires, pushing out whoever stands on it. */
function pistonAcross(id, blockId, dir, o = {}) {
  const B = PL.get(blockId), th = 1.6, wid = 5, h = 3.4, clear = 0.4, d = DIRS[dir], axis = d[0] ? 'x' : 'z', sgn = d[0] || d[1];
  const lo = axis === 'x' ? B.x0 : B.z0, hi = axis === 'x' ? B.x1 : B.z1, mid = axis === 'x' ? (B.z0 + B.z1) / 2 : (B.x0 + B.x1) / 2;
  const c0 = sgn > 0 ? lo - clear - th / 2 : hi + clear + th / 2, cEnd = sgn > 0 ? hi + clear - th / 2 : lo - clear + th / 2, cy = B.top + 1;
  return { id, p: axis === 'x' ? [r2(c0), r2(cy), r2(mid)] : [r2(mid), r2(cy), r2(c0)], s: axis === 'x' ? [th, h, wid] : [wid, h, th], axis, travel: r2(cEnd - c0), period: o.period ?? 7, phase: o.phase ?? 0, push: 9, lane: wid };
}
export const WHISPER_LAYOUT = {
  spawn: [8, YD, 0],
  voidY: -40,
  segments: [
    {
      id: 'descent', name: 'The Descent', kind: 'encounter',
      checkpoint: [8, YD, 0], region: { minX: -1, maxX: 58, minZ: -23, maxZ: 23, minY: YD - 2, maxY: 31 },
      conduits: [[14, YD, 0]],
      eyes: [{ p: [30, YD + 3.5, -22], n: [0, 1] }, { p: [38, YD + 3, 22], n: [0, -1] }, { p: [0, YD + 4.5, 12], n: [1, 0] }],
      gate: { p: [57, YD, 0], w: 6, h: 6.5, axis: 'z' },
      spawns: [[34, YD, -10], [34, YD, 10], [44, YD, -16], [44, YD, 16], [26, YD, -16], [26, YD, 16], [48, YD, 0], [40, YD, -4]],
      exit: null,
    },
    {
      id: 'shaft', name: 'The Red Shaft', kind: 'traversal',
      checkpoint: [79, YD, 0], region: { minX: 74, maxX: 108, minZ: -22, maxZ: 80, minY: -45, maxY: YG + 8 },
      conduits: [[79, YD, 4], at('sh_c2a'), at('sh_c3a'), at('sh_c4a'), at(shD.ids[6]), at('sh_e5')], // one per stage and a rest block half way up the last chain
      phaseBlocks: [shA, shB, shC, shD].flatMap((c) => c.ids.map((id) => blk(id))),
      movers: [
        pistonAcross('sm1', 'sh_a4', '+x', { period: 6.8, phase: 0 }),
        { id: 'sm2', p: [77, SH[1] + 1, 53], s: [1.6, 3.4, 5.2], axis: 'x', travel: 5, period: 7.4, phase: 2.2, push: 9, lane: 5.2 },
        pistonAcross('sm3', 'sh_c3', '-x', { period: 7.0, phase: 3.1 }),
        pistonAcross('sm4', 'sh_d8', '+x', { period: 7.6, phase: 1.4 }),
      ],
      secret: { eyes: [{ p: [76, SH[1] + 7, 30], n: [1, 0] }, { p: [92, SH[2] + 9, -21.5], n: [0, 1] }, { p: [106, SH[3] + 6, 22], n: [-1, 0] }], blocks: shS.ids.map((id) => blk(id)), chest: at(shS.ids[2]) },
      spawns: [at('sh_c2a', 0.4, 0.4), at('sh_c3a', 0.5, 0.6), at('sh_c4a', 0.3, 0.5), at('sh_c2p'), at('sh_c3b'), at('sh_c4a', 0.7, 0.5), at('sh_c4s'), at('sh_e5', 0.3, 0.5), at('sh_c3a', 0.3, 0.3), at('sh_c2a', 0.7, 0.8)],
      ambush: [
        { p: at('sh_c2a'), r: 7, spawns: [at('sh_c3a', 0.3, 0.3), at('sh_c3b'), at('sh_c3a', 0.7, 0.7)] },
        { p: at('sh_c3a'), r: 7, spawns: [at('sh_c4a', 0.3, 0.5), at('sh_c4a', 0.7, 0.5), at('sh_c4s')] },
        { p: at('sh_c4a'), r: 7, spawns: [at('sh_e5', 0.3, 0.5), at('sh_e5', 0.7, 0.5), at('sh_e5', 0.5, 0.5)] },
      ],
      exit: { p: [109, YG, -19], r: 2.2 },
    },
    {
      id: 'gallery', name: 'Blight Gallery', kind: 'encounter',
      checkpoint: [126, YG, -19], region: { minX: 120, maxX: 182, minZ: -27, maxZ: 27, minY: YG - 2, maxY: YG + 22.4 },
      conduits: [[132, YG, -18], [172, YG, 18]],
      eyes: [
        { p: [140, YG + 5, -26], n: [0, 1] }, { p: [160, YG + 6.5, -26], n: [0, 1] }, { p: [134, YG + 6, 26], n: [0, -1] },
        { p: [154, YG + 5, 26], n: [0, -1] }, { p: [180, YG + 5.5, -15], n: [-1, 0] }, { p: [180, YG + 6.5, 15], n: [-1, 0] },
      ],
      glyph: [179.2, YG + 9, 0], glyphW: 8, // in front of the dark frame (front face x 179.45), filling it
      blights: [[134.5, YG + 1.6, -15.5], [129.5, YG + 1.6, -20.5], [169.5, YG + 1.6, 15.5], [174.5, YG + 1.6, 20.5]], // two guard each conduit (aura 5 m)
      gate: { p: [181, YG, 0], w: 6, h: 6.5, axis: 'z' },
      spawns: [[150, YG, -18], [144, YG, 0], [156, YG, 18], [164, YG, -6], [138, YG, 10], [170, YG, -16]],
    },
    {
      id: 'chasm', name: 'The Green Chasm', kind: 'traversal',
      checkpoint: [201, YG, 0], region: { minX: 196, maxX: 294, minZ: -18, maxZ: 72, minY: -45, maxY: YG + 56 },
      conduits: [at('ch_c0', 0.5, 0.4), at(chA.ids[6]), at(chA.ids[12]), at('ch_c2a'), at(chB.ids[5]), at('ch_c3a')],
      phaseBlocks: [chA, chB].flatMap((c) => c.ids.map((id) => blk(id))),
      movers: [
        pistonAcross('cm1', 'ch_a3', '+x', { period: 7.2, phase: 0.8 }),
        pistonAcross('cm2', 'ch_a10', '-z', { period: 6.9, phase: 3.4 }),
        pistonAcross('cm3', 'ch_b6', '+z', { period: 7.6, phase: 2.0 }),
        { id: 'cm4', p: [242.6, YG - DROP + 1, 63.2], s: [4.4, 3.4, 1.6], axis: 'z', travel: -8.4, period: 8, phase: 4.6, push: 9, lane: 4.4 },
      ],
      spawns: [at('ch_c1'), at('ch_c2a', 0.4, 0.4), at('ch_c2b'), at('ch_c2d', 0.3, 0.5), at('ch_c2a', 0.7, 0.7), at('ch_c2c'), at('ch_c2d', 0.7, 0.5), at('ch_c3a', 0.5, 0.3), at('ch_c3a', 0.5, 0.7), at('ch_exit')],
      ambush: [
        { p: at('ch_c0'), r: 8, spawns: [at('ch_c1'), at('ch_s1'), at('ch_c1', 0.3, 0.3)] },
        { p: at('ch_c2a'), r: 8, spawns: [at('ch_c2d', 0.3, 0.4), at('ch_c2d', 0.7, 0.6), at('ch_c2c')] },
        { p: at('ch_c2d'), r: 8, spawns: [at('ch_c3a', 0.5, 0.3), at('ch_c3a', 0.5, 0.7), at('ch_exit')] },
      ],
      exit: { p: [289, YB, 0], r: 2.5 },
    },
    {
      id: 'falls', name: 'The Falls', kind: 'boss',
      checkpoint: [315, YB, 0], region: { minX: 309, maxX: 381, minZ: -31, maxZ: 31, minY: YB - 2, maxY: YB + 52.4 },
      room: { minX: 310, maxX: 372, minZ: -30, maxZ: 30 },
      boss: [356, YB, 0], glyph: [371.2, YB + 18, 0], glyphW: 10, // high on the back wall (face x 372), behind the boss, framed
      conduits: [[334, YB, -22], [334, YB, 22], [366, YB, -22], [366, YB, 22]],
      eyes: [
        { p: [322, YB + 6, -30], n: [0, 1] }, { p: [340, YB + 9, -30], n: [0, 1] }, { p: [358, YB + 6, -30], n: [0, 1] }, { p: [368, YB + 9, -30], n: [0, 1] },
        { p: [328, YB + 9, 30], n: [0, -1] }, { p: [346, YB + 6, 30], n: [0, -1] }, { p: [362, YB + 9, 30], n: [0, -1] }, { p: [370, YB + 6, 30], n: [0, -1] },
      ],
      blights: [[336, YB + 2.5, -19.5], [336, YB + 2.5, 19.5], [364, YB + 2.5, -19.5], [364, YB + 2.5, 19.5]], // one guards each conduit (aura 5 m)
      spawns: [[320, YB, -20], [320, YB, 20], [340, YB, -26], [340, YB, 26], [354, YB, -26], [354, YB, 26], [326, YB, -8], [326, YB, 8]],
      chest: [348, YB, 0],
    },
  ],
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Fog and light per segment (blended by the player's x, see the driver in build)
// ---------------------------------------------------------------------------------------------------------------------------------
const MOODS = [
  { x: 40, fog: 0x1c130a, near: 14, far: 85, top: 0xc09860, bot: 0x4a3620, k: 1.7 },       // Descent: low amber
  { x: 58, fog: 0x1c130a, near: 14, far: 85, top: 0xc09860, bot: 0x4a3620, k: 1.7 },
  { x: 76, fog: 0x2a0b0b, near: 10, far: 72, top: 0xe05a44, bot: 0x3a1414, k: 1.7 },      // Red Shaft: red
  { x: 104, fog: 0x2a0b0b, near: 10, far: 72, top: 0xe05a44, bot: 0x3a1414, k: 1.7 },
  { x: 124, fog: 0x0b0b12, near: 16, far: 105, top: 0xc8d0f0, bot: 0x22222c, k: 1.5 },     // Blight Gallery: black and white
  { x: 178, fog: 0x0b0b12, near: 16, far: 105, top: 0xc8d0f0, bot: 0x22222c, k: 1.5 },
  { x: 199, fog: 0x0d3038, near: 8, far: 92, top: 0x7ad8e0, bot: 0x1a3a30, k: 1.5 },      // Green Chasm: teal mist
  { x: 292, fog: 0x0d3038, near: 8, far: 92, top: 0x7ad8e0, bot: 0x1a3a30, k: 1.5 },
  { x: 312, fog: 0x8a6420, near: 18, far: 160, top: 0xffe0a0, bot: 0x6a4a20, k: 1.7 },    // The Falls: golden haze
  { x: 400, fog: 0x8a6420, near: 18, far: 160, top: 0xffe0a0, bot: 0x6a4a20, k: 1.7 },
];

// ---------------------------------------------------------------------------------------------------------------------------------
// Building helpers (all heights ABSOLUTE; the kit's own helpers measure from the terrain)
// ---------------------------------------------------------------------------------------------------------------------------------
let _ub = null;
const UB = () => _ub || (_ub = new THREE.BoxGeometry(1, 1, 1));
/** Visual box centred at (x, y, z), size w x h x d, no collider. */
function vb(K, x, y, z, w, h, d, color, o = {}) {
  const m = new THREE.Mesh(o.geo || UB(), K.mat(color, o.glow));
  if (!o.geo) m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
  m.receiveShadow = true; m.castShadow = !!o.shadow;
  m.userData.noCollide = true;
  K.scene.add(m);
  return m;
}
/** Visual box by extents. */
const vx = (K, x0, x1, y0, y1, z0, z1, color, o) => vb(K, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color, o);
/** Solid box by extents at absolute heights (mesh + collider). */
const solid = (K, x0, x1, y0, y1, z0, z1, color, o = {}) => K.box((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color, { y: y0, abs: true, glow: o.glow });
/** Translucent effect mesh (light shafts, water, haze). */
function fx(K, geo, color, opacity, x, y, z, o = {}) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, fog: o.fog ?? true, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending }));
  m.position.set(x, y, z);
  m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
  m.userData.noCollide = true; m.renderOrder = 2;
  K.scene.add(m);
  return m;
}
const lamp = (K, x, y, z, color, intensity = 12, dist = 34) => K.light(x, y - K.ground(x, z), z, color, intensity, dist);

/** A run of wall along x (axis 'x', at z = fixed) or along z (axis 'z', at x = fixed) from a0 to a1 with doorways: gaps = [{ a, b, top }] (the wall is left out below top). */
function wallRun(K, axis, fixed, a0, a1, y0, y1, t, color, gaps = []) {
  const put = (u0, u1, yb, yt) => {
    if (u1 - u0 < 0.05 || yt - yb < 0.05) return;
    if (axis === 'x') solid(K, u0, u1, yb, yt, fixed - t / 2, fixed + t / 2, color);
    else solid(K, fixed - t / 2, fixed + t / 2, yb, yt, u0, u1, color);
  };
  let from = a0;
  for (const g of [...gaps].sort((p, q) => p.a - q.a)) {
    put(from, g.a, y0, y1);
    put(g.a, g.b, g.top, y1); // the lintel over the doorway
    from = g.b;
  }
  put(from, a1, y0, y1);
}
/** An enclosure: four walls round (x0..x1, z0..z1) from y0 to y1, a roof, doorways per side ({ n, s, w, e }: gap lists), ribs on the inside faces. */
function hall(K, h) {
  const t = h.t ?? 2, G = h.gaps || {};
  wallRun(K, 'x', h.z0 - t / 2, h.x0 - t, h.x1 + t, h.y0, h.y1, t, h.color, G.n);
  wallRun(K, 'x', h.z1 + t / 2, h.x0 - t, h.x1 + t, h.y0, h.y1, t, h.color, G.s);
  wallRun(K, 'z', h.x0 - t / 2, h.z0, h.z1, h.y0, h.y1, t, h.color, G.w);
  wallRun(K, 'z', h.x1 + t / 2, h.z0, h.z1, h.y0, h.y1, t, h.color, G.e);
  solid(K, h.x0 - t, h.x1 + t, h.y1, h.y1 + t, h.z0 - t, h.z1 + t, h.roof ?? h.color);
  if (h.ribs) {
    const step = h.ribStep ?? 4, rc = h.ribs.color, gl = h.ribs.glow, ab = h.ribs.avoid || [];
    const near = (side, u) => ab.some((a) => a[0] === side && Math.abs(a[1] - u) < (a[2] ?? 2)) || (G[side] || []).some((g) => u > g.a - 1.5 && u < g.b + 1.5);
    const ymid = (h.y0 + h.y1) / 2, ht = h.y1 - h.y0;
    for (let u = h.x0 + 2; u < h.x1 - 1; u += step) {
      for (const [side, z, dz] of [['n', h.z0, 1], ['s', h.z1, -1]]) {
        if (near(side, u)) continue;
        vb(K, u, ymid, z + dz * 0.18, 0.7, ht, 0.36, rc);
        if (gl) vb(K, u, ymid, z + dz * 0.38, 0.14, ht, 0.06, gl.color, { glow: gl.k });
      }
    }
    for (let u = h.z0 + 2; u < h.z1 - 1; u += step) {
      for (const [side, x, dx] of [['w', h.x0, 1], ['e', h.x1, -1]]) {
        if (near(side, u)) continue;
        vb(K, x + dx * 0.18, ymid, u, 0.36, ht, 0.7, rc);
        if (gl) vb(K, x + dx * 0.38, ymid, u, 0.06, ht, 0.14, gl.color, { glow: gl.k });
      }
    }
  }
}
/** A narrow tunnel along x between two halls: floor slab (visual), side walls and a roof. */
function tunnel(K, x0, x1, z0, z1, floorY, ceilY, color, trim) {
  const t = 2;
  solid(K, x0, x1, floorY + 0.01, ceilY, z0 - t, z0, color);
  solid(K, x0, x1, floorY + 0.01, ceilY, z1, z1 + t, color);
  solid(K, x0, x1, ceilY, ceilY + t, z0 - t, z1 + t, color);
  vx(K, x0, x1, floorY - 3, floorY, z0 - t, z1 + t, color);
  if (trim) { vx(K, x0, x1, floorY + 0.01, floorY + 0.09, z0 + 0.05, z0 + 0.3, trim.color, { glow: trim.k }); vx(K, x0, x1, floorY + 0.01, floorY + 0.09, z1 - 0.3, z1 - 0.05, trim.color, { glow: trim.k }); }
}
/** Hall floor: a slab under the terrain plateau (visual) with an optional inlay. */
const floorSlab = (K, id, color, thick = 4) => { const p = PL.get(id); return vx(K, p.x0, p.x1, p.top - thick, p.top, p.z0, p.z1, color); };
/** A ledge drawn as a slab with a glowing trim line along its edge. */
function ledgeV(K, p, color, trim, k = 0.7) {
  const th = 1.4;
  vx(K, p.x0, p.x1, p.top - th, p.top, p.z0, p.z1, color, { shadow: true });
  vx(K, p.x0, p.x1, p.top - 0.18, p.top - 0.02, p.z0 - 0.06, p.z1 + 0.06, trim, { glow: k });
}
/** A ramp drawn as a tilted slab with glowing side lines. */
function rampV(K, r, color, trim, k = 0.7) {
  const A = PL.get(r.from), B = PL.get(r.to), dx = r.x1 - r.x0, dz = r.z1 - r.z0, len = Math.hypot(dx, dz), rise = B.top - A.top;
  const yaw = Math.atan2(-dz, dx), pitch = Math.atan2(rise, len), L = Math.hypot(len, rise);
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, cy = (A.top + B.top) / 2;
  const th = 0.6, oy = -Math.cos(pitch) * th / 2; // the slab hangs under the surface line
  const sl = vb(K, cx, cy + oy, cz, L, th, r.w, color, { ry: yaw, rz: pitch, shadow: true });
  for (const s of [-1, 1]) vb(K, cx + Math.sin(yaw) * s * (r.w / 2), cy + 0.03, cz + Math.cos(yaw) * s * (r.w / 2), L, 0.1, 0.16, trim, { ry: yaw, rz: pitch, glow: k });
  return sl;
}
/** Vex pillar: solid column, bronze bands, a glowing core strip. */
function pillar(K, x, z, y0, h, w, color, band, glow) {
  solid(K, x - w / 2, x + w / 2, y0, y0 + h, z - w / 2, z + w / 2, color);
  for (const f of [0.08, 0.5, 0.92]) vb(K, x, y0 + h * f, z, w * 1.14, 0.5, w * 1.14, band);
  if (glow) { vb(K, x, y0 + h * 0.5, z, w + 0.08, h * 0.6, 0.18, glow.color, { glow: glow.k }); vb(K, x, y0 + h * 0.5, z, 0.18, h * 0.6, w + 0.08, glow.color, { glow: glow.k }); }
}
/** A static foothold by kind: a bronze wall ledge or shelf, a floating Vex fragment (tilted, with a dark underside and a glowing core), a broken pillar or a slab. */
function footV(K, p, c) {
  const w = p.x1 - p.x0, d = p.z1 - p.z0, cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2, dead = p.dead;
  if (p.kind === 'pillar') { solidless(K, p, c); return; }
  if (p.kind === 'rock') {
    // a floating fragment: a slab, a tapering underside and a glowing core, nothing holding it up
    vx(K, p.x0, p.x1, p.top - 0.7, p.top, p.z0, p.z1, dead ? c.dead : c.floor, { shadow: true });
    vx(K, p.x0 + w * 0.15, p.x1 - w * 0.15, p.top - 1.9, p.top - 0.7, p.z0 + d * 0.15, p.z1 - d * 0.15, c.dead);
    vx(K, p.x0 + w * 0.32, p.x1 - w * 0.32, p.top - 2.9, p.top - 1.9, p.z0 + d * 0.32, p.z1 - d * 0.32, c.dead);
    vx(K, p.x0 - 0.04, p.x1 + 0.04, p.top - 0.2, p.top - 0.03, p.z0 - 0.04, p.z1 + 0.04, c.trim, { glow: dead ? 0.3 : 0.7 });
    vb(K, cx, p.top - 1.5, cz, 0.5, 0.5, 0.5, c.glow, { glow: 1.4, rz: 0.6, rx: 0.6 });
    return;
  }
  ledgeV(K, p, dead ? c.dead : c.floor, c.trim, dead ? 0.35 : 0.8);
  if (p.kind === 'shelf') { vx(K, p.x0, p.x1, p.top - 4, p.top - 1.4, p.z0, p.z1, c.pillar); vb(K, cx, p.top - 0.9, cz, w * 0.5, 0.3, 0.3, c.band); }
}
function solidless(K, p, c) {
  const w = p.x1 - p.x0, cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2, h = 9;
  vx(K, p.x0, p.x1, p.top - h, p.top, p.z0, p.z1, c.pillar, { shadow: true });
  for (const f of [0.1, 0.5, 0.9]) vb(K, cx, p.top - h * f, cz, w * 1.14, 0.45, (p.z1 - p.z0) * 1.14, c.band);
  vx(K, p.x0 - 0.04, p.x1 + 0.04, p.top - 0.2, p.top - 0.03, p.z0 - 0.04, p.z1 + 0.04, c.trim, { glow: p.dead ? 0.3 : 0.8 });
}
/** Wall socket: a bronze ring round a dim teal disc, facing (fx, fz). */
function socket(K, x, y, z, fxd, fzd, r, k = 0.5, ring = BRONZE2) {
  const ry = fxd ? Math.PI / 2 : 0, flat = new THREE.CylinderGeometry(r * 0.78, r * 0.78, 0.22, 14);
  const disc = vb(K, x, y, z, 1, 1, 1, TEALG, { geo: flat, glow: k, rx: fxd ? 0 : Math.PI / 2, rz: fxd ? Math.PI / 2 : 0 });
  vb(K, x + fxd * 0.05, y, z + fzd * 0.05, 1, 1, 1, ring, { geo: new THREE.TorusGeometry(r, r * 0.16, 5, 14), ry });
  vb(K, x + fxd * 0.12, y, z + fzd * 0.12, 1, 1, 1, ring, { geo: new THREE.TorusGeometry(r * 0.5, r * 0.07, 4, 10), ry });
  return disc;
}
/** Taken blight growth: H22 uses the shared blight look (black orb with a pale halo, js/blight-look.js), as the mechanic blights and Blight Edge do. */
function blightDecor(K, x, y, z, s) {
  const o = blightOrb(s);
  o.group.position.set(x, y, z);
  o.core.rotation.set(x, z, 0); // each growth's streaks lie differently
  o.core.userData.noCollide = true;
  K.scene.add(o.group);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The set
// ---------------------------------------------------------------------------------------------------------------------------------
const WHISPER = {
  spawn: [8, 0],            // x, z only: the terrain height under it is 0 (the void). Use WHISPER_LAYOUT.spawn (y = 10) to place the player.
  bounds: [-20, 390, -45, 100],
  leapLinks: whisperLeapLinks(), // the static footholds a class jump could hop between (U21b); the route check proves none skips a phase stretch
  zones: [],
  terrain: terrainFeatures(),
  noEdge: true, merge: true, hideBulbs: true, lightPool: 8, lockIn: false,
  voidBelow: 1,             // ground under 1 m is the abyss: no floor
  fallText: 'The dark takes you',
  build(K) {
    let ringRef = null;
    // the terrain mesh is not wanted (ledges are drawn as slabs that match their plateaus exactly)
    for (const o of K.scene.children.slice()) if (o.isMesh && o.material?.vertexColors && o.geometry?.attributes?.color) { K.scene.remove(o); o.geometry.dispose(); }

    // ============================== 1. THE DESCENT: dim bronze, low amber ==============================
    {
      const x0 = 0, x1 = 56, z0 = -22, z1 = 22, y0 = YD - 3, y1 = YD + 20;
      hall(K, { x0, x1, z0, z1, y0, y1, color: D_WALL, roof: 0x2c2218, gaps: { e: [{ a: -3, b: 3, top: YD + 6.5 }] },
        ribs: { color: BRONZE2, glow: { color: AMBER, k: 0.7 }, avoid: [['n', 30, 2.5], ['s', 38, 2.5], ['w', 12, 2.5]] } });
      floorSlab(K, 'd_floor', D_FLOOR);
      // inlaid amber rings round the conduit and the middle of the hall
      for (const [x, z, r] of [[14, 0, 3.2], [14, 0, 5.4], [36, 0, 7], [36, 0, 11]]) vb(K, x, YD + 0.03, z, 1, 1, 1, AMBER, { geo: new THREE.TorusGeometry(r, 0.12, 3, 40).rotateX(Math.PI / 2), glow: 0.8 });
      vb(K, 14, YD + 0.15, 0, 1, 1, 1, BRONZE2, { geo: new THREE.CylinderGeometry(2.6, 2.9, 0.3, 14) });
      // columns along the long walls and a few low blocks to fight round
      for (const x of [8, 20, 32, 44, 52]) for (const [z, s] of [[-19.5, 1], [19.5, -1]]) pillar(K, x, z, YD, 20, 3, 0x5a4630, BRONZE, { color: AMBER, k: 0.9 });
      for (const [x, z, w, d, h] of [[24, -9, 3, 2.4, 1.6], [24, 9, 3, 2.4, 1.6], [36, 0, 4, 2, 2.2], [44, -11, 2.6, 2.6, 1.8], [44, 11, 2.6, 2.6, 1.8], [30, -15, 2.4, 2.4, 1.5], [30, 15, 2.4, 2.4, 1.5]]) {
        solid(K, x - w / 2, x + w / 2, YD, YD + h, z - d / 2, z + d / 2, 0x5a4630);
        vx(K, x - w / 2 - 0.05, x + w / 2 + 0.05, YD + h * 0.55, YD + h * 0.55 + 0.1, z - d / 2 - 0.05, z + d / 2 + 0.05, AMBER, { glow: 1.1 });
      }
      // the sealed hatch you came through (west wall) and the shaft of surface light above the spawn
      vb(K, 0.4, YD + 3.6, 0, 1, 1, 1, BRONZE, { geo: new THREE.TorusGeometry(3.4, 0.5, 6, 22), ry: Math.PI / 2 });
      vb(K, 0.5, YD + 3.6, 0, 1, 1, 1, AMBER, { geo: new THREE.CircleGeometry(2.9, 22), ry: Math.PI / 2, glow: 0.9 });
      vb(K, 8, y1 - 0.05, 0, 1, 1, 1, AMBER, { geo: new THREE.CircleGeometry(5.5, 20).rotateX(Math.PI / 2), glow: 1.6 });
      fx(K, new THREE.CylinderGeometry(5.4, 3.6, y1 - YD, 18, 1, true), AMBER, 0.1, 8, (YD + y1) / 2, 0, { add: true });
      // Vex gate frame over the way on (east)
      vb(K, 56.2, YD + 7.4, 0, 1.2, 1.4, 8.6, BRONZE);
      vb(K, 56.2, YD + 3.2, -3.6, 1.2, 6.4, 1.0, BRONZE); vb(K, 56.2, YD + 3.2, 3.6, 1.2, 6.4, 1.0, BRONZE);
      for (const [x, z, c, i] of [[8, 0, AMBER, 12], [28, -12, AMBER, 9], [28, 12, AMBER, 9], [46, 0, AMBER, 10], [14, 0, 0xffd08a, 6]]) lamp(K, x, YD + 6, z, c, i, 36);
      tunnel(K, 58, 74, -3, 3, YD, YD + 6.5, D_WALL, { color: AMBER, k: 0.7 });
      lamp(K, 66, YD + 4.5, 0, AMBER, 7, 22);
    }

    // ============================== 2. THE RED SHAFT: vertical, red light, teal sockets ==============================
    {
      const H = HALLS.shaft, x0 = H.x0, x1 = H.x1, z0 = H.z0, z1 = H.z1, y0 = -70, y1 = YG + 22, ym = (y0 + y1) / 2, hh = y1 - y0;
      const eyeSpots = (WHISPER_LAYOUT.segments.find((s) => s.id === 'shaft').secret?.eyes || []).map((e) => e.p);
      const nearEye = (wallX, wallZ, u) => eyeSpots.some((p) => (wallX !== null ? Math.abs(p[0] - wallX) < 0.5 && Math.abs(p[2] - u) < 3.4 : Math.abs(p[2] - wallZ) < 0.5 && Math.abs(p[0] - u) < 3.4));
      vx(K, x0, x1, y0, y0 + 1, z0, z1, 0x050305); // the dark far below
      hall(K, { x0, x1, z0, z1, y0, y1, color: S_WALL, roof: 0x241010, gaps: { w: [{ a: -3, b: 3, top: YD + 6.5 }], e: [{ a: -20.6, b: -17.4, top: YG + 5.5 }] } });
      // deep wall panels: dark red ribs up all four walls (kept clear of the tunnel mouths and the hidden eyes)
      for (let u = x0 + 2; u < x1 - 1; u += 5) for (const [z, dz] of [[z0, 1], [z1, -1]]) { if (nearEye(null, z, u)) continue; vb(K, u, ym, z + dz * 0.25, 1.1, hh, 0.5, S_RIB); vb(K, u, ym, z + dz * 0.52, 0.16, hh, 0.06, S_GLOW, { glow: 0.5 }); }
      for (let u = z0 + 2; u < z1 - 1; u += 5) for (const [x, dx] of [[x0, 1], [x1, -1]]) {
        if ((Math.abs(u - (-19)) < 2.4 && dx < 0) || (Math.abs(u) < 3.6 && dx > 0) || nearEye(x, null, u)) continue;
        vb(K, x + dx * 0.25, ym, u, 0.5, hh, 1.1, S_RIB); vb(K, x + dx * 0.52, ym, u, 0.06, hh, 0.16, S_GLOW, { glow: 0.5 });
      }
      for (let y = 18; y < y1; y += 6) { vb(K, 91, y, z0 + 0.2, x1 - x0, 0.5, 0.4, S_RIB); vb(K, 91, y, z1 - 0.2, x1 - x0, 0.5, 0.4, S_RIB); }
      // the wall sockets of the reference: bronze rings round dim teal eyes, up all four walls (decor: they never answer to a shot)
      for (let y = YD + 5; y < y1 - 4; y += 6.5) {
        for (const u of [82, 100]) { if (!nearEye(null, z0, u)) socket(K, u, y + (u === 100 ? 2 : 0), z0 + 0.3, 0, 1, 1.1, 0.35); if (!nearEye(null, z1, u + 2)) socket(K, u + 2, y + 1, z1 - 0.3, 0, -1, 1.1, 0.35); }
        for (const z of [-14, 14, 44, 66]) { if (!nearEye(x0, null, z)) socket(K, x0 + 0.3, y + 1, z, 1, 0, 1.2, 0.35); if (!nearEye(x1, null, z + 3)) socket(K, x1 - 0.3, y + 3, z + 3, -1, 0, 1.2, 0.35); }
      }
      // a great fallen slab across the top, as in the reference, and a red shaft of light from above
      vb(K, 92, y1 - 7, 8, 34, 2.4, 9, 0x4a1a18, { rz: 0.32, ry: 0.1 });
      vb(K, 92, y1 - 6.4, 8, 34, 0.3, 9.2, S_GLOW, { rz: 0.32, ry: 0.1, glow: 0.4 });
      vb(K, 96, y1 - 0.05, 30, 1, 1, 1, S_GLOW, { geo: new THREE.CircleGeometry(7, 5).rotateX(Math.PI / 2), glow: 1.6 });
      fx(K, new THREE.CylinderGeometry(7.2, 3.4, 40, 5, 1, true), S_GLOW, 0.11, 96, y1 - 20, 30, { add: true });
      fx(K, new THREE.CylinderGeometry(3, 1.4, 24, 5, 1, true), 0xff7a5a, 0.08, 96, y1 - 12, 30, { add: true });
      // footholds: wall shelves, floating Vex fragments, broken pillars and slabs (the blocks themselves are built by mechanics.js)
      for (const p of PL.values()) if (p.seg === 'shaft' && p.kind !== 'floor' && p.kind !== 'block') footV(K, p, { floor: S_FLOOR, dead: 0x4a2420, trim: S_GLOW, pillar: 0x3a1816, band: BRONZE2, glow: RED });
      // the hidden cache's alcove: a dark Vex niche over the far end of the side path, seen only when you know to look
      { const b = PL.get('sh_s2'), cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; vb(K, cx, b.top + 2.6, z1 - 0.3, 6.4, 6.4, 0.5, 0x120808); vb(K, cx, b.top + 2.6, z1 - 0.6, 6.8, 6.8, 0.2, BRONZE2); vb(K, cx, b.top + 5.7, z1 - 0.7, 1.2, 1.2, 0.2, AMBER, { glow: 1.2 }); lamp(K, cx, b.top + 3, cz, AMBER, 5, 12); }
      tunnel(K, 106, 122, -20.6, -17.4, YG, YG + 5.5, S_WALL, { color: S_GLOW, k: 0.6 });
      for (const [x, y, z, i] of [[80, 13, 4, 13], [79.5, SH[1] + 3, 53, 13], [86.5, SH[2] + 3, 6, 13], [94.5, SH[3] + 3, 51, 13], [102.5, YG + 3, -19, 14], [80, SH[1] + 1, 30, 10], [86.5, SH[2] + 1, 30, 10], [94.5, SH[3] + 1, 30, 10], [102.5, SH[4] - 1, 20, 10], [112, YG + 3.5, -19, 8]]) lamp(K, x, y, z, S_GLOW, i, 30);
    }

    // ============================== 3. BLIGHT GALLERY: black and white, Taken blight ==============================
    {
      const x0 = 122, x1 = 180, z0 = -26, z1 = 26, y0 = YG - 3, y1 = YG + 20;
      hall(K, { x0, x1, z0, z1, y0, y1, color: G_WALL, roof: 0x07070a, gaps: { w: [{ a: -20.6, b: -17.4, top: YG + 5.5 }], e: [{ a: -3, b: 3, top: YG + 6.5 }] },
        ribs: { color: G_WHITE, glow: { color: G_BLUE, k: 0.8 }, avoid: [['n', 140, 2], ['n', 160, 2], ['s', 134, 2], ['s', 154, 2], ['e', -15, 2], ['e', 15, 2], ['e', 0, 5]] } });
      floorSlab(K, 'g_floor', G_FLOOR);
      // white aisle and a chequer of white tiles
      vx(K, x0 + 1, x1 - 1, YG + 0.02, YG + 0.05, -1.2, 1.2, G_WHITE, { glow: 0.2 });
      for (let x = 128; x < 176; x += 12) for (let z = -18; z <= 18; z += 12) if (((x - 128) / 12 + (z + 18) / 12) % 2 === 0 && Math.abs(z) > 3) vx(K, x, x + 6, YG + 0.02, YG + 0.04, z - 3, z + 3, G_WHITE, { glow: 0.1 });
      // white columns with black plinths, black arches overhead
      for (const x of [136, 150, 164]) for (const z of [-10, 10]) { solid(K, x - 1.8, x + 1.8, YG, YG + 1.4, z - 1.8, z + 1.8, 0x15151b); pillar(K, x, z, YG + 1.4, 18.6, 2.4, G_WHITE, 0x1a1a22, { color: G_BLUE, k: 1.0 }); }
      for (const x of [128, 143, 157, 171]) { vb(K, x, y1 - 1, 0, 1.6, 2, 52, 0x15151b); vb(K, x, y1 - 2.1, 0, 0.5, 0.2, 52, G_BLUE, { glow: 0.9 }); }
      // blight growths: black clumps on the walls and ceiling, a pale ring round each
      for (const [x, y, z, s] of [[128, YG + 12, -25, 1.6], [150, YG + 14, -25, 2], [172, YG + 11, -25, 1.5], [132, YG + 13, 25, 1.8], [162, YG + 12, 25, 1.6], [146, YG + 17, -6, 2.2], [160, YG + 17, 8, 1.8], [124, YG + 8, -8, 1.4], [178, YG + 14, 18, 1.7], [139, YG + 2, -21, 1.1], [168, YG + 2, 21, 1.3], [156, YG + 2, -22, 0.9]]) blightDecor(K, x, y, z, s);
      // low black slabs to fight round
      for (const [x, z, w, d, h] of [[128, -8, 4, 1.6, 1.8], [143, 17, 4, 1.6, 1.8], [157, -17, 4, 1.6, 1.8], [172, 8, 4, 1.6, 1.8], [150, 0, 2.2, 2.2, 1.5], [165, -2, 2.2, 2.2, 1.5]]) {
        solid(K, x - w / 2, x + w / 2, YG, YG + h, z - d / 2, z + d / 2, 0x16161c);
        vx(K, x - w / 2 - 0.04, x + w / 2 + 0.04, YG + h - 0.12, YG + h, z - d / 2 - 0.04, z + d / 2 + 0.04, G_WHITE, { glow: 0.5 });
      }
      // the blank board over the gate where the glyphs will be shown (frame only)
      vb(K, 179.7, YG + 9, 0, 0.5, 5.6, 9, 0x15151b); vb(K, 179.75, YG + 9, 0, 0.1, 5.8, 9.2, G_WHITE, { glow: 0.4 }); // H22: the white rim sits inside the dark board (its face was coplanar with the board's and z-fought)
      vb(K, 180.4, YG + 3.2, -3.6, 1.2, 6.4, 1.0, G_WHITE, { glow: 0.2 }); vb(K, 180.4, YG + 3.2, 3.6, 1.2, 6.4, 1.0, G_WHITE, { glow: 0.2 }); vb(K, 180.4, YG + 7.4, 0, 1.2, 1.4, 8.6, G_WHITE, { glow: 0.2 });
      for (const [x, z, i] of [[132, -18, 12], [172, 18, 12], [150, 0, 10], [128, 10, 8], [172, -14, 8], [150, -22, 8], [150, 22, 8]]) lamp(K, x, YG + 7, z, G_BLUE, i, 36);
      tunnel(K, 182, 198, -3, 3, YG, YG + 6.5, G_WALL, { color: G_BLUE, k: 0.6 });
      lamp(K, 190, YG + 4.5, 0, G_BLUE, 7, 22);
    }

    // ============================== 4. THE GREEN CHASM: mossy teal canyon, light from above ==============================
    {
      const H = HALLS.chasm, x0 = H.x0, x1 = H.x1, z0 = H.z0, z1 = H.z1, y0 = -70, y1 = YG + 40, ym = (y0 + y1) / 2, hh = y1 - y0;
      vx(K, x0, x1, y0, y0 + 1, z0, z1, 0x03090b); // the dark far below
      hall(K, { x0, x1, z0, z1, y0, y1, color: C_WALL, roof: 0x0a1a1e, gaps: { w: [{ a: -3, b: 3, top: YG + 6.5 }], e: [{ a: -3, b: 3, top: YB + 6.5 }] } });
      // tall slab faces down every wall, and great leaning slabs overhead, as in the reference
      for (let u = x0 + 4; u < x1; u += 9) for (const [z, dz, k] of [[z0, 1, 0], [z1, -1, 1]]) {
        vb(K, u, ym, z + dz * 0.4, 5.5, hh, 0.8, k ? C_WALL2 : C_LEDGE);
        vb(K, u + 4.2, ym, z + dz * 0.25, 0.4, hh, 0.5, 0x1d3a42);
      }
      for (let u = z0 + 6; u < z1 - 2; u += 11) for (const [x, dx, k] of [[x0, 1, 0], [x1, -1, 1]]) {
        if (Math.abs(u) < 5) continue; // the tunnel mouths
        vb(K, x + dx * 0.4, ym, u, 0.8, hh, 5.5, k ? C_WALL2 : C_LEDGE);
      }
      for (const [x, y, z, w, h, rz, ry] of [[216, y1 - 22, 5, 26, 2, 0.5, 0.05], [262, y1 - 18, 40, 30, 2.4, -0.48, -0.06], [240, y1 - 10, 20, 22, 2, 0.3, 0.12], [284, y1 - 26, 55, 18, 1.8, 0.4, 0], [225, y1 - 16, 50, 20, 2, -0.3, 0.2]]) vb(K, x, y, z, w, h, 6, C_WALL2, { rz, ry });
      // the bright slit high above and the shafts of teal light falling down the canyon
      vx(K, x0 + 4, x1 - 4, y1 - 0.3, y1 - 0.02, -1.4, 1.4, C_LIGHT, { glow: 2.4 });
      vx(K, x0 + 4, x1 - 4, y1 - 0.3, y1 - 0.02, 38, 41, C_LIGHT, { glow: 2.4 });
      for (let x = 206; x < 290; x += 17) for (const z of [0, 40]) fx(K, new THREE.BoxGeometry(5, 70, 3.6), 0x6ad8e0, 0.07, x, y1 - 36, z, { add: true, rz: 0.06 });
      // footholds: slabs, floating fragments, pillars and shelves, with moss over them
      for (const p of PL.values()) if (p.seg === 'chasm' && p.kind !== 'floor' && p.kind !== 'block') {
        footV(K, p, { floor: C_LEDGE, dead: 0x2e5258, trim: TEALG, pillar: C_WALL2, band: 0x1d3a42, glow: TEALG });
        const w = p.x1 - p.x0, d = p.z1 - p.z0;
        vx(K, p.x0 + w * 0.15, p.x0 + w * 0.55, p.top + 0.01, p.top + 0.06, p.z0 + d * 0.2, p.z0 + d * 0.65, C_MOSS, { glow: 0.05 });
        if (!p.dead && w > 3) vb(K, p.x0 + w * 0.7, p.top + 0.35, p.z0 + d * 0.3, 1.1, 0.7, 0.9, 0x4a7a22, { rz: 0.2, ry: p.x0 });
      }
      // a dark seam down the middle of the far wall (the reference's black crack)
      vb(K, 291.3, YG + 2, 0, 0.3, 80, 1.2, 0x04121a);
      for (const [x, y, z, i] of [[204, YG + 6, 2, 12], [202, 40, 36, 12], [222, 40, 56, 12], [244, YG - DROP + 6, 58, 12], [262, 36, 38, 12], [272, 31, 16, 12], [282, YB + 6, 2, 11], [236, 46, 20, 10]]) lamp(K, x, y, z, 0x6ad8d8, i, 40);
      tunnel(K, 294, 310, -3, 3, YB, YB + 6.5, C_WALL, { color: TEALG, k: 0.5 });
      lamp(K, 302, YB + 4.5, 0, 0x7ad8e0, 7, 22);
    }

    // ============================== 5. THE FALLS: golden haze, four waterfalls, the sun-ring ==============================
    {
      const x0 = 310, x1 = 380, z0 = -30, z1 = 30, y0 = YB - 3, y1 = YB + 50;
      hall(K, { x0, x1, z0, z1, y0, y1, color: F_WALL, roof: 0x1a130c, gaps: { w: [{ a: -3, b: 3, top: YB + 6.5 }] },
        ribs: { color: F_RIB, glow: { color: F_GOLD, k: 0.45 }, ribStep: 6, avoid: [['n', 322, 2], ['n', 340, 2], ['n', 358, 2], ['n', 368, 2], ['s', 328, 2], ['s', 346, 2], ['s', 362, 2], ['s', 370, 2]] } });
      floorSlab(K, 'f_floor', F_FLOOR, 5);
      // dry grass and a few rocks on the sand
      for (let i = 0; i < 60; i++) {
        const x = 314 + ((i * 53) % 50) + ((i * 7) % 5) * 0.5, z = -27 + ((i * 37) % 54) + ((i * 3) % 4) * 0.4;
        if (Math.abs(z) < 4 && x < 330) continue;
        vb(K, x, YB + 0.25, z, 1, 1, 1, F_GRASS, { geo: new THREE.ConeGeometry(0.18, 0.5 + ((i * 13) % 5) * 0.12, 4), ry: i });
      }
      for (const [x, z, s] of [[318, -14, 0.9], [332, 18, 1.1], [352, -22, 0.8], [362, 14, 1.2]]) vb(K, x, YB + s * 0.35, z, 1, 1, 1, 0x4a3422, { geo: new THREE.DodecahedronGeometry(s, 0), ry: x });
      // cover: Vex blocks with a gold seam
      for (const [x, z, w, d, h] of [[326, -14, 2.6, 2.6, 2.2], [326, 14, 2.6, 2.6, 2.2], [344, -8, 3, 2.4, 3.2], [344, 8, 3, 2.4, 3.2], [344, -20, 2.4, 2.4, 1.8], [344, 20, 2.4, 2.4, 1.8], [360, -10, 2.6, 2.6, 2.6], [360, 10, 2.6, 2.6, 2.6], [352, 0, 2, 2, 1.4]]) {
        solid(K, x - w / 2, x + w / 2, YB, YB + h, z - d / 2, z + d / 2, 0x4a3828);
        vx(K, x - w / 2 - 0.05, x + w / 2 + 0.05, YB + h * 0.6, YB + h * 0.6 + 0.12, z - d / 2 - 0.05, z + d / 2 + 0.05, F_GOLD, { glow: 1.0 });
      }
      // the back: Vex block cliffs with four channels, a waterfall in each, a pool at the foot
      const FZ = [-21, -7, 7, 21], CH = 3, edges = [-30, ...FZ.flatMap((z) => [z - CH, z + CH]), 30];
      for (let i = 0; i < edges.length; i += 2) {
        const za = edges[i], zb = edges[i + 1], hh = [18, 24, 20, 26, 16][i / 2] ?? 20;
        solid(K, 372, 380, YB, YB + hh, za, zb, 0x3a2c1e);
        solid(K, 374.5, 380, YB + hh, YB + hh + 7, za + 0.6, zb - 0.6, 0x2e2318);
        vx(K, 371.9, 372.1, YB + 3, YB + hh - 1, za + 0.5, zb - 0.5, F_RIB);
        vx(K, 371.8, 372.2, YB + hh * 0.5, YB + hh * 0.5 + 0.14, za + 0.2, zb - 0.2, F_GOLD, { glow: 0.8 });
      }
      // the glyph board's frame on the back wall (board at x 371.2 sits in front of it; the cliff face is x 372)
      vb(K, 371.75, YB + 18, 0, 0.5, 3.4, 10.8, 0x15110c); for (const dy of [-1.75, 1.75]) vb(K, 371.45, YB + 18 + dy, 0, 0.1, 0.14, 10.9, F_GOLD, { glow: 0.6 });
      for (const zc of FZ) {
        solid(K, 372, 380, YB + 24, y1, zc - CH, zc + CH, 0x2a2016); // the lintel the water spills from
        const fall = fx(K, new THREE.BoxGeometry(0.6, 24, CH * 2 - 0.8), F_WATER, 0.88, 379.4, YB + 12, zc, { fog: false });
        fall.userData.fall = true;
        fx(K, new THREE.BoxGeometry(7, 3.4, CH * 2 - 0.4), F_WATER, 0.16, 376, YB + 1.8, zc, { add: true });
        vx(K, 372.6, 380, YB + 0.02, YB + 0.07, zc - CH + 0.3, zc + CH - 0.3, F_WATER, { glow: 0.9 });
        lamp(K, 376, YB + 7, zc, F_GOLD, 14, 38);
      }
      // the sun-ring hanging high above (decor only): a dark Vex ring round a blazing core, with a small white ring at its heart
      const RC = [345, YB + 38, 0];
      const ringGroup = new THREE.Group();
      ringGroup.position.set(...RC);
      const mk = (geo, color, o = {}) => { const m = new THREE.Mesh(geo, o.basic ? new THREE.MeshBasicMaterial({ color, transparent: !!o.op, opacity: o.op ?? 1, depthWrite: !o.op, fog: false, side: THREE.DoubleSide, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending }) : K.mat(color, o.glow)); m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); m.userData.noCollide = true; ringGroup.add(m); return m; };
      mk(new THREE.TorusGeometry(21, 1.9, 5, 36), 0x2a2016, { rx: Math.PI / 2 });
      mk(new THREE.TorusGeometry(17.5, 0.7, 4, 36), BRONZE2, { rx: Math.PI / 2, glow: 0.3 });
      mk(new THREE.TorusGeometry(24.5, 0.8, 4, 36), 0x1a130c, { rx: Math.PI / 2 });
      mk(new THREE.CircleGeometry(20, 36), F_GOLD, { basic: true, op: 0.34, add: true, rx: Math.PI / 2 });
      mk(new THREE.CircleGeometry(11, 28), 0xfff0c0, { basic: true, op: 0.5, add: true, rx: Math.PI / 2 });
      mk(new THREE.SphereGeometry(3.2, 12, 8), 0xffffff, { basic: true });
      const arcs = mk(new THREE.TorusGeometry(7.4, 0.2, 4, 28, 4.6), 0xffffff, { basic: true, rx: Math.PI / 2 });
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const b = new THREE.Mesh(UB(), K.mat(i % 2 ? BRONZE2 : 0x3a2c1e)); b.scale.set(3.2, 1.6, 2.2); b.position.set(Math.cos(a) * 21, 0, Math.sin(a) * 21); b.rotation.y = -a; b.userData.noCollide = true; ringGroup.add(b); }
      ringGroup.rotation.set(0.16, 0, 0.06);
      K.scene.add(ringGroup);
      fx(K, new THREE.CircleGeometry(60, 28), F_GOLD, 0.1, 345, YB + 24, 0, { rx: Math.PI / 2, add: true, fog: false });
      for (const [x, y, z, i] of [[320, 14, 0, 14], [345, 18, -14, 14], [345, 18, 14, 14], [330, YB + 6, -22, 10], [330, YB + 6, 22, 10], [364, YB + 8, 0, 12]]) lamp(K, x, y, z, F_GOLD, i, 44);

      // the ledges and ramps of the descent into this hall are drawn above (chasm); nothing more here
      ringRef = { group: ringGroup, arcs };
    }

    // ============================== driver: per-segment fog and light, ring and water shimmer ==============================
    const hemi = K.scene.children.find((o) => o.isHemisphereLight), sunL = K.scene.children.find((o) => o.isDirectionalLight);
    const hemiK0 = hemi ? hemi.intensity : 1, sunK0 = sunL ? sunL.intensity : 0.2;
    const falls = [];
    K.scene.traverse((o) => { if (o.userData.fall) falls.push(o); });
    const ring = ringRef, ca = new THREE.Color(), cb = new THREE.Color();
    const driver = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.001, 0, 0, 0, 0.001, 0], 3)), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    driver.frustumCulled = false; driver.castShadow = false; driver.userData.noCollide = true; driver.userData.noMerge = true;
    driver.onBeforeRender = (renderer, scene, camera) => {
      if (!camera.isPerspectiveCamera) return;
      const x = camera.matrixWorld.elements[12], t = performance.now() / 1000;
      let i = 0;
      while (i < MOODS.length - 2 && x > MOODS[i + 1].x) i++;
      const A = MOODS[i], B = MOODS[i + 1], f = Math.max(0, Math.min(1, (x - A.x) / (B.x - A.x))), s = f * f * (3 - 2 * f);
      ca.setHex(A.fog).lerp(cb.setHex(B.fog), s);
      if (scene.fog) { scene.fog.color.copy(ca); scene.fog.near = A.near + (B.near - A.near) * s; scene.fog.far = A.far + (B.far - A.far) * s; }
      if (scene.background?.isColor) scene.background.copy(ca);
      if (hemi) { hemi.color.setHex(A.top).lerp(cb.setHex(B.top), s); hemi.groundColor.setHex(A.bot).lerp(cb.setHex(B.bot), s); hemi.intensity = hemiK0 * (A.k + (B.k - A.k) * s); }
      if (sunL) sunL.intensity = sunK0;
      if (ring) { ring.group.rotation.y = t * 0.03; ring.arcs.rotation.z = t * 0.4; }
      for (const w of falls) w.material.opacity = 0.8 + 0.1 * Math.sin(t * 2.4 + w.position.z);
    };
    K.scene.add(driver);
  },
};

// ---------------------------------------------------------------------------------------------------------------------------------
// U21b: glyph readability check. Builds the level into a recorder (no renderer), then for every shootable eye and every glyph board
// checks, from the places a player stands in that segment: (1) the symbol is not embedded in a wall or decor, (2) a clear line of sight
// exists from somewhere it can be read, (3) its angular size there is big enough. Console: checkWhisperSymbols().
// ---------------------------------------------------------------------------------------------------------------------------------
export const SYMBOL_MIN_DEG = 4;      // an eye's symbol (EYE_SYM.size) must span at least this many degrees from its best viewing spot
export const BOARD_MIN_DEG = 12;      // a glyph board must span at least this many degrees (its width) from its best viewing spot
function recordWhisper() {
  const boxes = [], scene = new THREE.Scene();
  const K = { scene, mat: () => new THREE.MeshBasicMaterial(), light: () => {}, ground: () => 0,
    box: (cx, cz, w, h, d, color, o = {}) => { const y0 = o.abs ? o.y : (o.y ?? 0); boxes.push({ x0: cx - w / 2, x1: cx + w / 2, y0, y1: y0 + h, z0: cz - d / 2, z1: cz + d / 2 }); } };
  WHISPER.build(K);
  scene.updateMatrixWorld(true);
  const ub = UB(), tmp = new THREE.Box3();
  for (const m of scene.children) if (m.isMesh && m.geometry === ub && !m.rotation.x && !m.rotation.y && !m.rotation.z) {
    tmp.setFromObject(m);
    if (m.material?.transparent) continue;
    boxes.push({ x0: tmp.min.x, x1: tmp.max.x, y0: tmp.min.y, y1: tmp.max.y, z0: tmp.min.z, z1: tmp.max.z, visual: true });
  }
  return boxes;
}
/** True when the open segment a -> b passes through the box (a small `inset` shrinks the box so a surface the target sits on does not count). */
function segHits(a, b, bx, inset = 0.02) {
  let t0 = 0, t1 = 1;
  for (const k of [0, 1, 2]) {
    const lo = [bx.x0, bx.y0, bx.z0][k] + inset, hi = [bx.x1, bx.y1, bx.z1][k] - inset, o = a[k], d = b[k] - a[k];
    if (hi <= lo) return false;
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return false; continue; }
    let ta = (lo - o) / d, tb = (hi - o) / d; if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return false;
  }
  return true;
}
const inBox = (p, bx, e = 0.02) => p[0] > bx.x0 + e && p[0] < bx.x1 - e && p[1] > bx.y0 + e && p[1] < bx.y1 - e && p[2] > bx.z0 + e && p[2] < bx.z1 - e;
/** Checks every eye symbol and glyph board. Returns { problems: [string], rows: [string] }. */
export function checkWhisperSymbols() {
  const boxes = recordWhisper(), problems = [], rows = [];
  for (const seg of WHISPER_LAYOUT.segments) {
    const views = [seg.checkpoint, ...(seg.conduits || []), ...(seg.spawns || []), seg.gate?.p, seg.exit?.p].filter(Boolean).map((v) => [v[0], v[1] + 1.7, v[2]]);
    // a traversal is read while climbing: add the static footholds of the segment
    for (const f of PL.values()) if (f.seg === seg.id && f.kind !== 'block') views.push([(f.x0 + f.x1) / 2, f.top + 1.7, (f.z0 + f.z1) / 2]);
    const rg = seg.region, face = rg ? { x: (rg.minX + rg.maxX) / 2, z: (rg.minZ + rg.maxZ) / 2 } : null;
    const targets = [];
    (seg.eyes || []).forEach((e, i) => {
      const nx = e.n[0], nz = e.n[1], rx = -nz, rz = nx, h = EYE_SYM.size / 2, c = [e.p[0] + nx * EYE_SYM.z, e.p[1] + EYE_SYM.y, e.p[2] + nz * EYE_SYM.z];
      targets.push({ name: `${seg.id} eye ${i}`, c, n: [nx, 0, nz], size: EYE_SYM.size, min: SYMBOL_MIN_DEG,
        pts: [c, ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [c[0] + rx * u * h, c[1] + v * h, c[2] + rz * u * h])] });
    });
    if (seg.glyph) {
      const w = boardWidth(seg), h = w / 8, yaw = boardYaw({ x: seg.glyph[0], z: seg.glyph[2] }, face), nx = Math.sin(yaw), nz = Math.cos(yaw), rx = nz, rz = -nx, c = seg.glyph;
      targets.push({ name: `${seg.id} board`, c, n: [nx, 0, nz], size: w, min: BOARD_MIN_DEG,
        pts: [c, ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [c[0] + rx * u * w / 2, c[1] + v * h, c[2] + rz * u * w / 2])] });
    }
    for (const t of targets) {
      const embedded = t.pts.filter((q) => boxes.some((bx) => inBox(q, bx)));
      if (embedded.length) problems.push(`${t.name}: ${embedded.length} of 5 symbol points sit inside a wall or decor box`);
      let best = null, facing = 0, seen = 0;
      for (const v of views) {
        const dx = v[0] - t.c[0], dy = v[1] - t.c[1], dz = v[2] - t.c[2], d = Math.hypot(dx, dy, dz);
        if (d < 1 || (dx * t.n[0] + dz * t.n[2]) / d < 0.25) continue;
        facing++;
        // line of sight to the centre and to at least 3 of the 4 corners, so a pillar cannot hide half of it
        const clear = t.pts.filter((q) => { const e = [q[0] + (v[0] - q[0]) * 0.02, q[1] + (v[1] - q[1]) * 0.02, q[2] + (v[2] - q[2]) * 0.02]; return !boxes.some((bx) => segHits(v, e, bx)); });
        if (!clear.includes(t.pts[0]) || clear.length < 4) continue;
        seen++;
        const deg = 2 * Math.atan(t.size / 2 / d) * 180 / Math.PI;
        if (!best || deg > best.deg) best = { deg, d, v };
      }
      const ok = best && best.deg >= t.min;
      rows.push(`${t.name}: ${best ? `${best.deg.toFixed(1)} deg from ${best.d.toFixed(1)} m` : 'NOT SEEN'} (best of ${seen} clear views, ${facing} facing) ${ok ? 'ok' : 'PROBLEM'}`);
      if (!best) problems.push(`${t.name}: no standing spot in the segment has a clear line of sight to it`);
      else if (!ok) problems.push(`${t.name}: only ${best.deg.toFixed(1)} deg from its best spot (needs ${t.min})`);
    }
  }
  return { problems, rows };
}

export default { whisper: WHISPER };
