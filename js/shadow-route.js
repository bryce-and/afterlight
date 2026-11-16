// U23 chunk B: the Underbelly's route proof (docs/ENDGAME_RULES.md, Traversal). Pure (no scene): tools/tests.js runs it, and the dev
// console has checkShadowRoute(). It proves, as problems:
//   - no class jump or glide at Mobility 50 (js/jump-reach.js: lift, high and strafe lifts and jumps, triple jump, the three glides,
//     sprinting in the air) gets from one deck stage to the next, or onto a sniper perch, through static footholds alone. The graph joins
//     every pair of footholds a jump can cover (plus REACH_MARGIN), taking off from the deck or from the top of deck cover
//     (COVER_LIFT: level-shadow.js keeps deck cover at most 2.2 m tall). Piston boxes count as footholds at rest and fully out.
//     Blink and the Strand grapple are exempt (Bryce) and not modelled;
//   - every grate hop on the intended route is a base jump (70 percent of the walking max, the Whisper's rule), both ways;
//   - every piston and furnace vent leaves a safe window longer than a crossing needs (exotic-rules.js moverSafe, imported only).
import { UB_FOOT, UB_GRATES, SHADOW_LAYOUT, GT_LAND, GT_PERCH, GT_STEPS, GT_WARDS, GT_ROWS, THRONE, TY } from './level-shadow.js';
import { reachTable, bestRise, REACH_MOBILITY, REACH_MARGIN, RISE_MARGIN, WALK, JUMP0, GRAV } from './jump-reach.js';
import { moverSafe, moverBox } from './exotic-rules.js';

export const COVER_LIFT = 2.4; // deck cover is at most 2.2 m; 0.2 m to spare
const COVER_DECKS = new Set(['ub_a1', 'ub_a3', 'ub_b1', 'ub_c1']);
const MAXRISE = 0.9, FRAC = 0.7;
/** The base jump's walking gap for a rise (negative: a drop), as level-whisper.js. */
export const maxGap = (rise) => (WALK * (JUMP0 + Math.sqrt(Math.max(0, JUMP0 * JUMP0 - 2 * GRAV * rise)))) / GRAV;
const rect = (f) => ({ id: f.id, x0: Math.min(f.x0, f.x1), x1: Math.max(f.x0, f.x1), z0: Math.min(f.z0, f.z1), z1: Math.max(f.z0, f.z1), top: f.top, stage: f.stage });
const gap = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.z0 - b.z1, b.z0 - a.z1));
const seg = () => SHADOW_LAYOUT.segments.find((s) => s.id === 'underbelly');

/** Every static thing a player could stand on in the Underbelly: footholds, and each piston's swept box (rest to fully out). */
export function shadowNodes() {
  const out = UB_FOOT.map(rect);
  for (const m of seg().movers) {
    const a = moverBox(m, 0), b = moverBox(m, 1);
    out.push({ id: m.id, x0: Math.min(a.min[0], b.min[0]), x1: Math.max(a.max[0], b.max[0]), z0: Math.min(a.min[2], b.min[2]), z1: Math.max(a.max[2], b.max[2]), top: a.max[1], stage: null });
  }
  return out;
}

/** `opts.extra`: more footholds to add (the tests use it to prove a planted skip is caught). */
export function checkShadowRoute(opts = {}) {
  const sprint = opts.sprint ?? true, problems = [], rows = [];
  const nodes = [...shadowNodes(), ...(opts.extra || []).map(rect)], byId = new Map(nodes.map((n) => [n.id, n]));
  const top = bestRise(REACH_MOBILITY, sprint);
  rows.push(`class jumps at Mobility ${REACH_MOBILITY}, sprint ${sprint}: highest climb ${top.toFixed(2)} m (+${RISE_MARGIN} margin), distance margin ${REACH_MARGIN.toFixed(1)} m, cover lift ${COVER_LIFT} m`);
  // ---- the static graph: an edge where any class jump covers the void (from the deck or from its cover) ----
  const adj = new Map(nodes.map((n) => [n.id, []]));
  for (const A of nodes) for (const B of nodes) {
    if (A === B) continue;
    const g = gap(A, B);
    for (const lift of COVER_DECKS.has(A.id) ? [0, COVER_LIFT] : [0]) {
      const reach = reachTable(B.top - (A.top + lift), REACH_MOBILITY, sprint);
      if (reach !== null && g < reach + REACH_MARGIN) { adj.get(A.id).push([B.id, `void ${g.toFixed(1)} m, rise ${(B.top - A.top - lift).toFixed(1)}, reach ${reach.toFixed(1)}${lift ? ' (from cover)' : ''}`]); break; }
    }
  }
  const reachFrom = (start) => {
    const seen = new Map([[start, null]]), q = [start];
    while (q.length) { const a = q.shift(); for (const [b, why] of adj.get(a)) if (!seen.has(b)) { seen.set(b, [a, why]); q.push(b); } }
    return seen;
  };
  for (const [stage, start] of [[0, 'ub_a1'], [1, 'ub_b1']]) {
    const seen = reachFrom(start);
    const bad = [...seen.keys()].filter((id) => { const s = byId.get(id).stage; return s === 'perch' || (typeof s === 'number' && s > stage); });
    for (const id of bad) {
      const path = []; let c = id;
      while (c) { const s = seen.get(c); path.unshift(c + (s ? ` (${s[1]})` : '')); c = s?.[0]; }
      problems.push(`stage ${stage}: ${start} reaches ${id} without a grate: ${path.join(' -> ')}`);
    }
    if (!bad.length) rows.push(`stage ${stage}: from ${start} a class jump reaches ${seen.size} of ${nodes.length} footholds, none past the next grate stretch`);
  }
  // ---- the grate runs: base jumps all the way, both ways ----
  const hopOk = (A, B) => { const rise = B.top - A.top, g = gap(A, B); return rise <= MAXRISE && g <= FRAC * maxGap(rise) + 1e-9; };
  for (const [run, from, to] of [['G1', 'ub_a3', 'ub_b1'], ['G2', 'ub_b2', 'ub_c1']]) {
    const chain = [byId.get(from), ...UB_GRATES.filter((g) => g.run === run).map(rect), byId.get(to)];
    let worst = 0;
    for (let k = 1; k < chain.length; k++) {
      const A = chain[k - 1], B = chain[k];
      if (!hopOk(A, B) || !hopOk(B, A)) problems.push(`${run}: ${A.id} <-> ${B.id} is not a base jump (gap ${gap(A, B).toFixed(2)}, rise ${(B.top - A.top).toFixed(2)})`);
      worst = Math.max(worst, gap(A, B) / (FRAC * maxGap(B.top - A.top)));
    }
    const A = byId.get(from), B = byId.get(to), rise = B.top - A.top, reach = reachTable(rise - COVER_LIFT, REACH_MOBILITY, sprint);
    rows.push(`${run} ${from} -> ${to}: ${chain.length - 2} grates, void ${gap(A, B).toFixed(1)} m, rise ${rise.toFixed(2)} m, best class jump from cover ${reach === null ? 'cannot climb it' : reach.toFixed(1) + ' m'}; hardest grate hop ${(100 * worst).toFixed(0)} percent of the base limit`);
  }
  // ---- movers and vents: a safe window for every one ----
  for (const m of [...seg().movers, ...seg().vents]) {
    const w = moverSafe(m);
    rows.push(`${m.id}: safe ${w.safe.toFixed(1)} s of ${m.period} s, crossing needs ${w.need.toFixed(1)} s`);
    if (w.safe < w.need) problems.push(`${m.id} has ${w.safe.toFixed(1)} s safe but a crossing needs ${w.need.toFixed(1)} s`);
  }
  // ---- U23 chunk C: the Gauntlet ----
  const g = checkGauntlet({ sprint, extra: opts.gextra });
  return { problems: [...problems, ...g.problems], rows: [...rows, ...g.rows] };
}

/**
 * U23 chunk C: the Gauntlet's proof. Footholds are its landings, the sniper perches, the Throne hall and each ward's swept box (tops 8.5 m over
 * their tile). From each landing (taking off from the deck or from cover up to COVER_LIFT on the row landings), no class jump may reach a
 * foothold of a later stage; every stair hop is a base jump both ways; every ward leaves a safe window. `opts.extra` plants footholds.
 */
export function checkGauntlet(opts = {}) {
  const sprint = opts.sprint ?? true, problems = [], rows = [];
  const H = THRONE.hall;
  const nodes = [
    ...GT_LAND.map(rect), ...GT_PERCH.map(rect),
    { id: 'gardens', x0: -50, x1: 50, z0: -213, z1: -299, top: 11, stage: 0 },
    { id: 'throne', x0: H.x0, x1: H.x1, z0: Math.min(H.z0, H.z1), z1: Math.max(H.z0, H.z1), top: TY, stage: 4 },
    ...GT_WARDS.map((m) => { const a = moverBox(m, 0), b = moverBox(m, 1); return { id: m.id, x0: Math.min(a.min[0], b.min[0]), x1: Math.max(a.max[0], b.max[0]), z0: Math.min(a.min[2], b.min[2]), z1: Math.max(a.max[2], b.max[2]), top: a.max[1], stage: null }; }),
    ...(opts.extra || []).map(rect),
  ];
  const cover = new Set(GT_ROWS.map((L) => L.id));
  const adj = new Map(nodes.map((n) => [n.id, []]));
  for (const A of nodes) for (const B of nodes) {
    if (A === B) continue;
    const d = gap(A, B);
    for (const lift of cover.has(A.id) ? [0, COVER_LIFT] : [0]) {
      const reach = reachTable(B.top - (A.top + lift), REACH_MOBILITY, sprint);
      if (reach !== null && d < reach + REACH_MARGIN) { adj.get(A.id).push([B.id, `void ${d.toFixed(1)} m, rise ${(B.top - A.top - lift).toFixed(1)}${lift ? ' (from cover)' : ''}`]); break; }
    }
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const L of GT_LAND.filter((x) => typeof x.stage === 'number' && x.stage < 4)) {
    const seen = new Map([[L.id, null]]), q = [L.id];
    while (q.length) { const a = q.shift(); for (const [b, why] of adj.get(a)) if (!seen.has(b)) { seen.set(b, [a, why]); q.push(b); } }
    const bad = [...seen.keys()].filter((id) => { const st = byId.get(id).stage; return typeof st === 'number' && st > L.stage; });
    for (const id of bad) {
      const path = []; let c = id;
      while (c) { const s2 = seen.get(c); path.unshift(c + (s2 ? ` (${s2[1]})` : '')); c = s2?.[0]; }
      problems.push(`Gauntlet stage ${L.stage}: ${L.id} reaches ${id} without the stair: ${path.join(' -> ')}`);
    }
    if (!bad.length) rows.push(`Gauntlet ${L.id}: a class jump reaches ${seen.size} of ${nodes.length} footholds, none past its stair`);
  }
  const hopOk = (A, B) => { const rise = B.top - A.top, d = gap(A, B); return rise <= MAXRISE && d <= FRAC * maxGap(rise) + 1e-9; };
  GT_ROWS.forEach((L, r) => {
    const next = GT_LAND[GT_LAND.indexOf(L) + 1];
    const chain = [rect(L), ...GT_STEPS.filter((t) => t.run === `S${r}`).map(rect), rect(next)];
    for (let k = 1; k < chain.length; k++) if (!hopOk(chain[k - 1], chain[k]) || !hopOk(chain[k], chain[k - 1])) problems.push(`S${r}: ${chain[k - 1].id} <-> ${chain[k].id} is not a base jump`);
    rows.push(`S${r} ${L.id} -> ${next.id}: ${chain.length - 2} grate steps, climb ${(next.top - L.top).toFixed(2)} m (no class jump climbs over ${bestRise(REACH_MOBILITY, sprint).toFixed(2)} m)`);
  });
  for (const m of GT_WARDS) {
    const w = moverSafe(m);
    if (w.safe < w.need) problems.push(`${m.id} has ${w.safe.toFixed(1)} s safe but a crossing needs ${w.need.toFixed(1)} s`);
  }
  rows.push(`${GT_WARDS.length} wards: safe ${moverSafe(GT_WARDS[0]).safe.toFixed(1)} s of ${GT_WARDS[0].period} s, a crossing needs ${moverSafe(GT_WARDS[0]).need.toFixed(1)} s`);
  return { problems, rows };
}
