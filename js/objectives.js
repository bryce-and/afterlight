// U15 objectives: the rules for what a zone asks of the fireteam besides "kill everything".
// Pure state and rules (no scene), so tools/tests.js can exercise them; game.js owns the meshes and the spawning.
// A zone's spec comes from story.js: { t: 'hold' | 'activate' | 'retrieve' | 'destroy' | 'survive', label, ... }.
//   hold      stand inside the ring until the bar fills (progress only counts while a Guardian is in it); `defend` adds reinforcements
//   activate  N consoles; hold E beside one to wake it
//   retrieve  press E beside the item to take it (nobody carries it; the Ghost scans it)
//   destroy   N targets (units) that must all die
//   survive   a countdown; no ring
// A zone clears when its waves are cleared AND its objective is done.

export const OBJ = {
  interactRange: 3.2,   // metres from a console or item to use it with E
  activateTime: 1.2,    // seconds holding E at a console
  holdRadius: 7,        // metres, the ring a hold objective is played in
  reinforceEvery: 13,   // seconds between reinforcement waves while a hold or survive is unfinished and the field is empty
  maxReinforce: 5,
};

export const OBJECTIVE_TYPES = ['hold', 'activate', 'retrieve', 'destroy', 'survive'];

/** A fresh objective state from a spec. Positions are filled in by the game (`placeObjective`). */
export function makeObjective(spec) {
  const o = { ...spec, done: false, reinforced: 0, reinforceT: OBJ.reinforceEvery };
  if (spec.t === 'hold' || spec.t === 'survive') { o.need = spec.secs ?? 30; o.prog = 0; }
  else if (spec.t === 'activate') o.nodes = Array.from({ length: spec.n ?? 3 }, () => ({ pos: null, prog: 0, done: false }));
  else if (spec.t === 'retrieve') o.item = { pos: null, taken: false };
  else if (spec.t === 'destroy') o.targets = [];
  else throw new Error(`Unknown objective type ${spec.t}`);
  return o;
}

/** Advance one objective by dt. `ctx`: inside(pos, r) -> bool (a Guardian within r), holding(pos, r) -> bool (a Guardian holding E within r), pressed(pos, r) -> bool (E pressed within r). Returns the objective. */
export function tickObjective(o, dt, ctx) {
  if (o.done) return o;
  if (o.t === 'hold') {
    if (ctx.inside(o.pos, OBJ.holdRadius)) o.prog = Math.min(o.need, o.prog + dt);
    o.done = o.prog >= o.need;
  } else if (o.t === 'survive') {
    o.prog = Math.min(o.need, o.prog + dt);
    o.done = o.prog >= o.need;
  } else if (o.t === 'activate') {
    for (const n of o.nodes) {
      if (n.done || !n.pos) continue;
      if (ctx.holding(n.pos, OBJ.interactRange)) { n.prog = Math.min(OBJ.activateTime, n.prog + dt); if (n.prog >= OBJ.activateTime) n.done = true; }
      else n.prog = Math.max(0, n.prog - dt * 2);
    }
    o.done = o.nodes.every((n) => n.done);
  } else if (o.t === 'retrieve') {
    if (!o.item.taken && o.item.pos && ctx.pressed(o.item.pos, OBJ.interactRange)) o.item.taken = true;
    o.done = o.item.taken;
  } else if (o.t === 'destroy') {
    o.done = o.targets.length > 0 && o.targets.every((e) => !e.alive);
  }
  return o;
}

/** Whether a reinforcement wave should come now (hold/survive, nothing alive, not done). Consumes the timer. */
export function wantsReinforcement(o, dt, alive) {
  if (o.done || (o.t !== 'hold' && o.t !== 'survive') || o.reinforced >= OBJ.maxReinforce) return false;
  if (alive > 0) { o.reinforceT = OBJ.reinforceEvery; return false; }
  o.reinforceT -= dt;
  if (o.reinforceT > 0) return false;
  o.reinforceT = OBJ.reinforceEvery; o.reinforced++;
  return true;
}

/** HUD line for an objective: "Hold the Mists beacon  ·  14 / 40 s". */
export function objectiveText(o) {
  const L = o.label || o.t;
  if (o.t === 'hold') return `${L}  ·  ${Math.floor(o.prog)} / ${o.need} s${o.holdRadiusMiss ? '  ·  return to the ring' : ''}`;
  if (o.t === 'survive') return `${L}  ·  ${Math.max(0, Math.ceil(o.need - o.prog))} s`;
  if (o.t === 'activate') return `${L}  ·  ${o.nodes.filter((n) => n.done).length} / ${o.nodes.length}`;
  if (o.t === 'retrieve') return o.item.taken ? `${L}  ·  secured` : L;
  if (o.t === 'destroy') return `${L}  ·  ${o.targets.filter((e) => e.alive).length} left`;
  return L;
}

/** The point the waypoint should show for an objective (the nearest unfinished piece), or null. */
export function objectiveTarget(o, from) {
  const pts = [];
  if (o.t === 'hold') pts.push(o.pos);
  else if (o.t === 'activate') for (const n of o.nodes) if (!n.done && n.pos) pts.push(n.pos);
  else if (o.t === 'retrieve') { if (!o.item.taken && o.item.pos) pts.push(o.item.pos); }
  else if (o.t === 'destroy') for (const e of o.targets) if (e.alive) pts.push(e.pos);
  if (!pts.length) return null;
  let best = pts[0], bd = Infinity;
  for (const p of pts) { const d = (p.x - from.x) ** 2 + (p.z - from.z) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
}

/** Ring positions for N pieces around a centre: evenly spread starting at `start` radians, `r` metres out. */
export function ringPoints(cx, cz, r, n, start = 0) {
  return Array.from({ length: n }, (_, i) => { const a = start + (i / n) * Math.PI * 2; return { x: cx + Math.sin(a) * r, z: cz + Math.cos(a) * r }; });
}
