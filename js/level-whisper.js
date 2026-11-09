// U21 "The Whisper": the exotic mission map (static geometry only). Five Vex caverns deep under Io, one linear path:
// The Descent (encounter), The Red Shaft (climb), Blight Gallery (encounter), The Green Chasm (descent), The Falls (boss).
// Interactive things (conduits, eyes, phase blocks, glyphs, blights, gates) are built by js/exotic-missions.js and js/mechanics.js from
// WHISPER_LAYOUT; this file builds terrain, walls, ceilings, ledges, decor, lights and the per-segment fog.
//
// HOW THE FLOOR WORKS. Every walkable surface is TERRAIN (js/terrain.js plateaus and ramps), so ground height, enemy nav, spawn heights
// and the nav "abyss" all work as on the Tangled Shore. Between the ledges the ground is 0, and `voidBelow: 1` makes ground under 1 m
// a void: no floor, you fall (WHISPER_LAYOUT.voidY = -40 is where a fall is called). The terrain mesh is removed in build(); each ledge
// is drawn as a slab that matches its plateau exactly. Walls, ceilings and cover are solid boxes at ABSOLUTE heights.
// Terrain is single valued, so no ledge may sit over another: the Red Shaft climbs in three rows side by side, not in a spiral.
//
// JUMP LIMITS (from js/player.js and js/armor.js, BASE jump only: no double / triple jump, no glide, no blink):
//   gravity 24 m/s^2, jump velocity 8.2 m/s (jumpV = 8.2 + 0.0125 * Mobility), walk 6.2 m/s (sprint x1.5 = 9.3, only forward), body radius 0.4.
//   max rise      = 8.2^2 / (2 * 24)                        = 1.40 m   (design limit 0.9 m, 64 percent)
//   max flat gap  = 6.2 * 2 * 8.2 / 24                      = 4.24 m walking, 6.36 m sprinting (design limit 2.8 m flat, 66 percent of walking)
//   gap at rise r = 6.2 * (8.2 + sqrt(8.2^2 - 48 r)) / 24   (rise +0.8: 3.51 m, design limit 2.2; drop -2.0: 5.42 m, design limit 3.2)
//   every jump is at most 70 percent of the walking figure for its own rise or drop, so it needs no sprint. The player can step up 0.6 m
//   (stairs) and walk ramps up to slope 0.55 (these use 0.45). checkWhisperRoute() re-checks every hop and prints the margin.
//   PHASE spans are 15.6 m of void: more than a sprint jump at 100 Mobility (about 11.8 m), so only the phase blocks cross them.
//   One-way drops (the Green Chasm) are 2.0 m; falling is free, climbing back is not meant to be possible.
import * as THREE from 'three';

export const WHISPER_JUMP = { v: 8.2, g: 24, walk: 6.2, sprint: 9.3, step: 0.6, r: 0.4 };
/** Farthest horizontal distance a jump can cover when it ends `rise` metres above (negative: below) where it started. */
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
// Data: platforms, ramps, hops (pure, so the route can be checked without building anything)
// ---------------------------------------------------------------------------------------------------------------------------------
const PL = new Map();   // id -> { id, x0, x1, z0, z1, top, kind: 'floor' | 'ledge' | 'block' | 'dead', seg }
const RAMPS = [];       // { id, from, to, x0, z0, x1, z1, w }
const HOPS = [];        // [from, to, kind]: 'jump' (two way), 'drop' (one way), 'phase' (a jump onto / between phase blocks), 'walk' (flush)
const SPANS = [];       // [from, to, [blocks]]: a void that only phase blocks cross
const plat = (id, seg, kind, x0, x1, z0, z1, top) => { PL.set(id, { id, seg, kind, x0, x1, z0, z1, top }); return id; };
const hop = (a, b, kind = 'jump') => HOPS.push([a, b, kind]);
const ramp = (id, from, to, x0, z0, x1, z1, w = 3.2) => RAMPS.push({ id, from, to, x0, z0, x1, z1, w });

const YD = 10;        // Descent floor
const YG = 21.6;      // Blight Gallery floor (top of the Red Shaft)
const YB = 5.6;       // The Falls floor (bottom of the Green Chasm)

// ---- Descent, tunnels and halls: big floors (terrain only; the hall builder draws them) ----
plat('d_floor', 'descent', 'floor', -1, 57, -23, 23, YD);
plat('t1_floor', 'descent', 'floor', 56.5, 76.5, -3, 3, YD);
plat('t2_floor', 'shaft', 'floor', 105.5, 122, -20.6, -17.4, YG);
plat('g_floor', 'gallery', 'floor', 121, 181, -27, 27, YG);
plat('t3_floor', 'gallery', 'floor', 180.5, 199, -3, 3, YG);
plat('t4_floor', 'chasm', 'floor', 290.5, 311, -3, 3, YB);
plat('f_floor', 'falls', 'floor', 309, 381, -31, 31, YB);

// ---- The Red Shaft: three rows side by side (z 0, -9.5, -19), x 76..106, never over one another ----
plat('sh_p0', 'shaft', 'ledge', 75.5, 82, -3, 8, YD);
plat('sh_l1', 'shaft', 'ledge', 93, 96, -1.6, 1.6, 15);
ramp('sh_r1', 'sh_p0', 'sh_l1', 82, 0, 93, 0);
plat('sh_t1', 'shaft', 'ledge', 98.2, 106, -11.1, 1.6, 15.8);
plat('sh_b1', 'shaft', 'block', 91.8, 95.4, -11.1, -7.9, 15.8);
plat('sh_b2', 'shaft', 'block', 85.4, 89, -11.1, -7.9, 15.8);
plat('sh_w2', 'shaft', 'ledge', 76, 82.6, -20.6, -7.9, 15.8);
plat('sh_l3', 'shaft', 'ledge', 93.6, 96.6, -20.6, -17.4, 20.8);
ramp('sh_r3', 'sh_w2', 'sh_l3', 82.6, -19, 93.6, -19);
plat('sh_e3', 'shaft', 'ledge', 98.8, 106, -20.6, -17.4, YG);
plat('sh_d1', 'shaft', 'dead', 93.6, 96.6, 4, 7.6, 15);
plat('sh_d2a', 'shaft', 'dead', 84.2, 87.2, 4, 8, YD);
plat('sh_d2b', 'shaft', 'dead', 89.4, 92.4, 4, 8, 10.8);
hop('sh_l1', 'sh_t1');
hop('sh_t1', 'sh_b1', 'phase'); hop('sh_b1', 'sh_b2', 'phase'); hop('sh_b2', 'sh_w2', 'phase');
SPANS.push(['sh_t1', 'sh_w2', ['sh_b1', 'sh_b2']]);
hop('sh_l3', 'sh_e3');
hop('sh_l1', 'sh_d1'); hop('sh_p0', 'sh_d2a'); hop('sh_d2a', 'sh_d2b');

// ---- The Green Chasm: a zigzag down a 19 m wide canyon, 2.0 m drops, one phase bridge ----
plat('ch_c0', 'chasm', 'ledge', 198, 204, -4, 8, YG);
plat('ch_c1', 'chasm', 'ledge', 207.2, 212.2, -8, -1, 19.6);
plat('ch_c2', 'chasm', 'ledge', 215.4, 220.4, -4, 3, 17.6);
plat('ch_c3', 'chasm', 'ledge', 223.6, 228.6, 1, 8, 15.6);
plat('ch_c4', 'chasm', 'ledge', 231.8, 236.8, -3, 5, 13.6);
plat('ch_b1', 'chasm', 'block', 239.6, 243.2, -1, 3, 13.6);
plat('ch_b2', 'chasm', 'block', 246, 249.6, -1, 3, 13.6);
plat('ch_c5', 'chasm', 'ledge', 252.4, 257.4, -4, 4, 13.6);
plat('ch_c6', 'chasm', 'ledge', 260.6, 265.6, -8, -1, 11.6);
plat('ch_c7', 'chasm', 'ledge', 268.8, 273.8, -4, 3, 9.6);
plat('ch_c8', 'chasm', 'ledge', 277, 282, 1, 8, 7.6);
plat('ch_c9', 'chasm', 'ledge', 285.2, 291.2, -4, 8, YB);
plat('ch_dA', 'chasm', 'dead', 216, 221, 5.8, 8.8, 17.6);
plat('ch_dB', 'chasm', 'dead', 261, 266, 1.8, 4.8, 11.6);
for (const [a, b] of [['ch_c0', 'ch_c1'], ['ch_c1', 'ch_c2'], ['ch_c2', 'ch_c3'], ['ch_c3', 'ch_c4'], ['ch_c5', 'ch_c6'], ['ch_c6', 'ch_c7'], ['ch_c7', 'ch_c8'], ['ch_c8', 'ch_c9']]) hop(a, b, 'drop');
hop('ch_c4', 'ch_b1', 'phase'); hop('ch_b1', 'ch_b2', 'phase'); hop('ch_b2', 'ch_c5', 'phase');
SPANS.push(['ch_c4', 'ch_c5', ['ch_b1', 'ch_b2']]);
hop('ch_c2', 'ch_dA'); hop('ch_c6', 'ch_dB');

/** The raw route data, for tools and the in-browser jump test. */
export const WHISPER_DATA = { PL, RAMPS, HOPS, SPANS };

/** Rectangle distance in the ground plane. */
const rectGap = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.z0 - b.z1, b.z0 - a.z1));
const MAXRISE = 0.9, FRAC = 0.7;
const hopOk = (A, B, frac = FRAC) => { const rise = B.top - A.top, gap = rectGap(A, B); return rise <= MAXRISE && gap <= frac * maxGap(rise) + 1e-9; };

/** Checks every hop with the base jump and every phase span against the strongest possible jump. Returns { problems, rows }. */
export function checkWhisperRoute() {
  const problems = [], rows = [];
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
  const strong = (rise) => maxGap(rise, WHISPER_JUMP.sprint * 1.5, WHISPER_JUMP.v + 0.0125 * 100) + 2 * WHISPER_JUMP.r;
  for (const [a, b] of SPANS) {
    const A = PL.get(a), B = PL.get(b), gap = rectGap(A, B), lim = strong(B.top - A.top);
    rows.push(`span ${a} -> ${b}: void ${gap.toFixed(1)} m, best jump at 100 Mobility ${lim.toFixed(1)} m`);
    if (gap < lim + 1.5) problems.push(`span ${a} -> ${b} (${gap.toFixed(1)} m) can be jumped without the phase blocks`);
  }
  // notes (not problems): ledges that could be jumped between without being linked on the route
  const route = [...PL.values()].filter((p) => p.kind === 'ledge' || p.kind === 'block');
  for (const A of route) for (const B of route) {
    if (A === B || A.seg !== B.seg || B.top - A.top > MAXRISE) continue;
    const linked = HOPS.some(([x, y]) => (x === A.id && y === B.id) || (x === B.id && y === A.id)) || RAMPS.some((r) => (r.from === A.id && r.to === B.id) || (r.from === B.id && r.to === A.id));
    const rise = B.top - A.top, gap = rectGap(A, B);
    if (!linked && gap <= maxGap(rise, WHISPER_JUMP.walk) && A.top - B.top < 4) rows.push(`note: ${A.id} could also reach ${B.id} (gap ${gap.toFixed(2)}, rise ${rise.toFixed(2)})`);
  }
  return { problems, rows };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Terrain: plateaus and ramps from the data above
// ---------------------------------------------------------------------------------------------------------------------------------
const EDGE = 0.12; // a short skirt: the ledge edge is a cliff (a landing on the skirt slides off into the void)
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
      checkpoint: [79, YD, 0], region: { minX: 74, maxX: 108, minZ: -22, maxZ: 9, minY: -45, maxY: 41 },
      conduits: [[79, YD, 4], [102, 15.8, -2]],
      phaseBlocks: [blk('sh_b1'), blk('sh_b2')],
      spawns: [[94.5, 15, 0], [104, 15.8, -5], [79, 15.8, -14], [95, 20.8, -19], [103, YG, -19]],
      exit: { p: [109, YG, -19], r: 2.2 },
    },
    {
      id: 'gallery', name: 'Blight Gallery', kind: 'encounter',
      checkpoint: [126, YG, -19], region: { minX: 120, maxX: 182, minZ: -27, maxZ: 27, minY: YG - 2, maxY: 44 },
      conduits: [[132, YG, -18], [172, YG, 18]],
      eyes: [
        { p: [140, YG + 5, -26], n: [0, 1] }, { p: [160, YG + 6.5, -26], n: [0, 1] }, { p: [134, YG + 6, 26], n: [0, -1] },
        { p: [154, YG + 5, 26], n: [0, -1] }, { p: [180, YG + 5.5, -15], n: [-1, 0] }, { p: [180, YG + 6.5, 15], n: [-1, 0] },
      ],
      glyph: [180, YG + 9, 0],
      blights: [[134.5, YG + 1.6, -15.5], [129.5, YG + 1.6, -20.5], [169.5, YG + 1.6, 15.5], [174.5, YG + 1.6, 20.5]], // two guard each conduit (aura 5 m)
      gate: { p: [181, YG, 0], w: 6, h: 6.5, axis: 'z' },
      spawns: [[150, YG, -18], [144, YG, 0], [156, YG, 18], [164, YG, -6], [138, YG, 10], [170, YG, -16]],
    },
    {
      id: 'chasm', name: 'The Green Chasm', kind: 'traversal',
      checkpoint: [201, YG, 0], region: { minX: 196, maxX: 294, minZ: -10, maxZ: 10, minY: -45, maxY: 76 },
      conduits: [[234.3, 13.6, 1]],
      phaseBlocks: [blk('ch_b1'), blk('ch_b2')],
      ambush: [
        { p: [205, YG, 0], r: 7, spawns: [[212, 19.6, -4], [218, 17.6, -1], [225, 15.6, 5]] },
        { p: [234, 13.6, 1], r: 6, spawns: [[254, 13.6, -1], [256, 13.6, 2], [263, 11.6, -5]] },
        { p: [270, 9.6, 0], r: 7, spawns: [[279, 7.6, 4], [288, YB, 0], [289, YB, 3]] },
      ],
      exit: { p: [289, YB, 0], r: 2.5 },
    },
    {
      id: 'falls', name: 'The Falls', kind: 'boss',
      checkpoint: [315, YB, 0], region: { minX: 309, maxX: 381, minZ: -31, maxZ: 31, minY: YB - 2, maxY: 58 },
      room: { minX: 310, maxX: 372, minZ: -30, maxZ: 30 },
      boss: [356, YB, 0], glyph: [356, YB + 6.5, 0],
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
/** Wall socket: a bronze ring round a dim teal disc, facing (fx, fz). */
function socket(K, x, y, z, fxd, fzd, r, k = 0.5, ring = BRONZE2) {
  const ry = fxd ? Math.PI / 2 : 0, flat = new THREE.CylinderGeometry(r * 0.78, r * 0.78, 0.22, 14);
  const disc = vb(K, x, y, z, 1, 1, 1, TEALG, { geo: flat, glow: k, rx: fxd ? 0 : Math.PI / 2, rz: fxd ? Math.PI / 2 : 0 });
  vb(K, x + fxd * 0.05, y, z + fzd * 0.05, 1, 1, 1, ring, { geo: new THREE.TorusGeometry(r, r * 0.16, 5, 14), ry });
  vb(K, x + fxd * 0.12, y, z + fzd * 0.12, 1, 1, 1, ring, { geo: new THREE.TorusGeometry(r * 0.5, r * 0.07, 4, 10), ry });
  return disc;
}
/** Black Taken blight clump: a dark blob with a pale ring. */
function blightDecor(K, x, y, z, s) {
  vb(K, x, y, z, 1, 1, 1, G_BLIGHT, { geo: new THREE.IcosahedronGeometry(s, 0), rx: x, ry: z });
  vb(K, x, y, z, 1, 1, 1, G_BLUE, { geo: new THREE.TorusGeometry(s * 1.35, 0.08, 4, 14), rx: 1.3 + x * 0.1, ry: z * 0.1, glow: 1.4 });
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The set
// ---------------------------------------------------------------------------------------------------------------------------------
const WHISPER = {
  spawn: [8, 0],            // x, z only: the terrain height under it is 0 (the void). Use WHISPER_LAYOUT.spawn (y = 10) to place the player.
  bounds: [-20, 390, -45, 45],
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
      const x0 = 76, x1 = 106, z0 = -21.5, z1 = 8, y0 = -70, y1 = 40;
      vx(K, x0, x1, y0, y0 + 1, z0, z1, 0x050305); // the dark far below
      hall(K, { x0, x1, z0, z1, y0, y1, color: S_WALL, roof: 0x241010, gaps: { w: [{ a: -3, b: 3, top: YD + 6.5 }], e: [{ a: -20.6, b: -17.4, top: YG + 5.5 }] } });
      // deep wall panels: dark red ribs on the long walls, bands up the shaft
      for (let u = x0 + 2; u < x1 - 1; u += 5) for (const [z, dz] of [[z0, 1], [z1, -1]]) { vb(K, u, 5, z + dz * 0.25, 1.1, 70, 0.5, S_RIB); vb(K, u, 5, z + dz * 0.52, 0.16, 70, 0.06, S_GLOW, { glow: 0.5 }); }
      for (let u = z0 + 2; u < z1 - 1; u += 5) for (const [x, dx] of [[x0, 1], [x1, -1]]) { if (Math.abs(u - (-19)) < 2.2 && dx < 0) continue; vb(K, x + dx * 0.25, 5, u, 0.5, 70, 1.1, S_RIB); vb(K, x + dx * 0.52, 5, u, 0.06, 70, 0.16, S_GLOW, { glow: 0.5 }); }
      for (const y of [12, 18, 24, 30, 36]) { vb(K, 91, y, z0 + 0.2, x1 - x0, 0.5, 0.4, S_RIB); vb(K, 91, y, z1 - 0.2, x1 - x0, 0.5, 0.4, S_RIB); }
      // the wall sockets of the reference: bronze rings round dim teal eyes, up all four walls
      const SK = [[0, 15, 1], [0, 21, 1], [0, 27, 1], [0, 33, 1]];
      for (const [, y] of SK) {
        for (const u of [82, 94, 100]) { socket(K, u, y + (u === 94 ? 2 : 0), z0 + 0.3, 0, 1, u === 94 ? 1.5 : 1.1, 0.35); socket(K, u + 2, y + 1, z1 - 0.3, 0, -1, u === 100 ? 1.5 : 1.1, 0.35); }
        socket(K, x0 + 0.3, y + 1, -14, 1, 0, 1.2, 0.35); socket(K, x0 + 0.3, y + 3, -2, 1, 0, 1.4, 0.35); socket(K, x1 - 0.3, y + 1, -5, -1, 0, 1.3, 0.35); socket(K, x1 - 0.3, y + 3, 4, -1, 0, 1.1, 0.35);
      }
      // a great fallen slab across the top, as in the reference, and a red shaft of light from above
      vb(K, 92, 34, -6, 34, 2.4, 9, 0x4a1a18, { rz: 0.32, ry: 0.1 });
      vb(K, 92, 34.6, -6, 34, 0.3, 9.2, S_GLOW, { rz: 0.32, ry: 0.1, glow: 0.4 });
      vb(K, 96, y1 - 0.05, -10, 1, 1, 1, S_GLOW, { geo: new THREE.CircleGeometry(7, 5).rotateX(Math.PI / 2), glow: 1.6 });
      fx(K, new THREE.CylinderGeometry(7.2, 3.4, 26, 5, 1, true), S_GLOW, 0.11, 96, 27, -10, { add: true });
      fx(K, new THREE.CylinderGeometry(3, 1.4, 16, 5, 1, true), 0xff7a5a, 0.08, 96, 30, -10, { add: true });
      // ledges, ramps and the blocks' bases (the blocks themselves are built by mechanics.js)
      for (const p of PL.values()) if (p.seg === 'shaft' && p.kind !== 'floor' && p.kind !== 'block') ledgeV(K, p, p.kind === 'dead' ? 0x4a2420 : S_FLOOR, S_GLOW, p.kind === 'dead' ? 0.35 : 0.8);
      for (const r of RAMPS) if (r.id.startsWith('sh_')) rampV(K, r, S_FLOOR, S_GLOW);
      // dead ends read as inviting: a bronze Vex shard on each
      for (const [x, y, z] of [[95, 15, 5.8], [90.9, 10.8, 6]]) { vb(K, x, y + 0.9, z, 0.7, 1.8, 0.7, BRONZE2); vb(K, x, y + 1.9, z, 0.5, 0.5, 0.5, RED, { glow: 2.2 }); }
      tunnel(K, 106, 122, -20.6, -17.4, YG, YG + 5.5, S_WALL, { color: S_GLOW, k: 0.6 });
      for (const [x, y, z, i] of [[80, 12, 4, 13], [100, 19, -2, 14], [80, 18, -14, 13], [100, 25, -19, 14], [90, 30, -8, 10], [112, YG + 3.5, -19, 8]]) lamp(K, x, y, z, S_GLOW, i, 30);
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
      vb(K, 179.7, YG + 9, 0, 0.5, 5.6, 9, 0x15151b); vb(K, 179.5, YG + 9, 0, 0.1, 5.8, 9.2, G_WHITE, { glow: 0.4 });
      vb(K, 180.4, YG + 3.2, -3.6, 1.2, 6.4, 1.0, G_WHITE, { glow: 0.2 }); vb(K, 180.4, YG + 3.2, 3.6, 1.2, 6.4, 1.0, G_WHITE, { glow: 0.2 }); vb(K, 180.4, YG + 7.4, 0, 1.2, 1.4, 8.6, G_WHITE, { glow: 0.2 });
      for (const [x, z, i] of [[132, -18, 12], [172, 18, 12], [150, 0, 10], [128, 10, 8], [172, -14, 8], [150, -22, 8], [150, 22, 8]]) lamp(K, x, YG + 7, z, G_BLUE, i, 36);
      tunnel(K, 182, 198, -3, 3, YG, YG + 6.5, G_WALL, { color: G_BLUE, k: 0.6 });
      lamp(K, 190, YG + 4.5, 0, G_BLUE, 7, 22);
    }

    // ============================== 4. THE GREEN CHASM: mossy teal canyon, light from above ==============================
    {
      const x0 = 198, x1 = 292, z0 = -9.5, z1 = 9.5, y0 = -70, y1 = 74;
      vx(K, x0, x1, y0, y0 + 1, z0, z1, 0x03090b); // the dark far below
      hall(K, { x0, x1, z0, z1, y0, y1, color: C_WALL, roof: 0x0a1a1e, gaps: { w: [{ a: -3, b: 3, top: YG + 6.5 }], e: [{ a: -3, b: 3, top: YB + 6.5 }] } });
      // tall slab faces and great leaning slabs, as in the reference
      for (let u = x0 + 4; u < x1; u += 9) for (const [z, dz, k] of [[z0, 1, 0], [z1, -1, 1]]) {
        vb(K, u, 24, z + dz * 0.4, 5.5, 108, 0.8, k ? C_WALL2 : C_LEDGE);
        vb(K, u + 4.2, 20, z + dz * 0.25, 0.4, 108, 0.5, 0x1d3a42);
      }
      for (const [x, y, z, w, h, rz, ry] of [[216, 46, 5, 26, 2, 0.5, 0.05], [262, 52, -6, 30, 2.4, -0.48, -0.06], [240, 62, 0, 22, 2, 0.3, 0.12], [284, 40, 7, 18, 1.8, 0.4, 0]]) vb(K, x, y, z, w, h, 6, C_WALL2, { rz, ry });
      // the bright slit high above and the shafts of teal light falling down the canyon
      vx(K, x0 + 4, x1 - 4, y1 - 0.3, y1 - 0.02, -1.4, 1.4, C_LIGHT, { glow: 2.4 });
      for (let x = 206; x < 290; x += 17) fx(K, new THREE.BoxGeometry(5, 70, 3.6), 0x6ad8e0, 0.07, x, y1 - 36, 0, { add: true, rz: 0.06 });
      // ledges drawn as slabs, with moss over them
      for (const p of PL.values()) if (p.seg === 'chasm' && p.kind !== 'floor' && p.kind !== 'block') {
        ledgeV(K, p, p.kind === 'dead' ? 0x2e5258 : C_LEDGE, TEALG, 0.35);
        const w = p.x1 - p.x0, d = p.z1 - p.z0;
        vx(K, p.x0 + w * 0.15, p.x0 + w * 0.55, p.top + 0.01, p.top + 0.06, p.z0 + d * 0.2, p.z0 + d * 0.65, C_MOSS, { glow: 0.05 });
        if (p.kind !== 'dead') vb(K, p.x0 + w * 0.7, p.top + 0.35, p.z0 + d * 0.3, 1.1, 0.7, 0.9, 0x4a7a22, { rz: 0.2, ry: p.x0 });
      }
      for (const [x, y, z, s] of [[203, YG + 0.6, 6.5, 0.9], [218, 17.6 + 0.6, 7.4, 0.8], [244, 18, -6.5, 1.1], [262, 11.6 + 0.6, 3.4, 0.7], [280, 7.6 + 0.6, 3, 0.8]]) vb(K, x, y, z, 1, 1, 1, 0x4a7a22, { geo: new THREE.DodecahedronGeometry(s, 0), ry: x, glow: 0.1 });
      // a dark seam down the middle of the far wall (the reference's black crack)
      vb(K, 291.3, 36, 0, 0.3, 80, 1.2, 0x04121a);
      for (const [x, y, z, i] of [[204, YG + 6, 2, 12], [222, 22, 3, 12], [240, 20, 1, 12], [256, 20, 0, 12], [272, 16, 0, 12], [286, 12, 2, 11]]) lamp(K, x, y, z, 0x6ad8d8, i, 40);
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

export default { whisper: WHISPER };
