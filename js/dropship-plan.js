// U32 "Dropships": pure logic (no THREE, no DOM) so tools/tests.js can exercise it.
// Which faction arrives how, how units are grouped into drops, the ship's timeline and flight path, and the open-sky check.

/** Arrival style by faction id. The Cabal (legion), Fallen (scrappers), Hive (hollow) and Scorn come by ship; the Vex and the Taken teleport in. */
export const ARRIVAL = Object.freeze({ legion: 'cabal', scrappers: 'fallen', hollow: 'hive', scorn: 'scorn', vex: 'teleport', taken: 'teleport' });
export const arrivalOf = (faction) => ARRIVAL[faction] || null;
export const isShip = (kind) => !!kind && kind !== 'teleport';

export const DROP = Object.freeze({
  perShip: 4,        // units one ship carries (raised when a wave would need more than maxShips)
  maxShips: 3,       // ships in the air at once for one wave
  hoverHeight: 12,   // m above the drop point
  clearHeight: 18,   // m of open sky the ship needs above the drop point
  clearRadius: 3,    // sky is checked at the centre and at four points this far out
  approachDist: 110, // m out where the ship comes into view
  approachTime: 2.6, // s from first sight to hover
  releaseGap: 0.28,  // s between units leaving the hatch
  leaveDelay: 0.6,   // s the ship hovers after the last unit leaves
  leaveTime: 2.4,    // s from hover to gone
  gravity: 24,       // m/s^2 on a dropped unit
  tpCharge: 0.9,     // s a teleport gate charges before the unit steps out
  tpGap: 0.14,       // s between the units of one teleport wave
  tpEnd: 0.5,        // s the gate lingers after the unit arrives
});

/**
 * Splits units into drops. Units of one faction ride together; each drop is at most `per` units, and `per` grows (up to 12)
 * until the whole wave needs no more than `maxShips` ships. Teleporters are never grouped (each steps out where it stands).
 * `items`: [{ faction, ... }]. Returns [{ kind, items }] in first-seen order.
 */
export function groupDrops(items, per = DROP.perShip, maxShips = DROP.maxShips) {
  const byKind = new Map();
  const tele = [];
  for (const it of items) {
    const kind = arrivalOf(it.faction);
    if (!kind) continue;
    if (kind === 'teleport') { tele.push(it); continue; }
    if (!byKind.has(kind)) byKind.set(kind, []);
    byKind.get(kind).push(it);
  }
  const ships = (p) => [...byKind.values()].reduce((s, a) => s + Math.ceil(a.length / p), 0);
  let p = per;
  while (p < 12 && ships(p) > maxShips) p++;
  const out = [];
  for (const [kind, a] of byKind) for (let i = 0; i < a.length; i += p) out.push({ kind, items: a.slice(i, i + p) });
  if (tele.length) out.push({ kind: 'teleport', items: tele });
  return out;
}

/** Is there open sky above (x, y, z)? `blocked(x, y, z)` says whether a point is inside solid geometry. Checks the column over the drop point and, at hover height, four points around it (nearby low buildings do not stop a ship). */
export function skyClear(blocked, x, y, z, h = DROP.clearHeight, r = DROP.clearRadius) {
  for (let dy = 3; dy <= h; dy += 3) if (blocked(x, y + dy, z)) return false; // the units' column, from head height up
  for (const [ox, oz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) for (let dy = DROP.hoverHeight - 3; dy <= h; dy += 3) if (blocked(x + ox, y + dy, z + oz)) return false; // the hull's footprint, at hover height and above
  return true;
}

/** Times (s from the ship's first sight) for a ship carrying `n` units: when it arrives, when each unit leaves the hatch, when it leaves and when it is gone. */
export function shipTimeline(n) {
  const arrive = DROP.approachTime;
  const release = Array.from({ length: n }, (_, i) => arrive + 0.3 + i * DROP.releaseGap);
  const leaveStart = (release[n - 1] ?? arrive) + DROP.leaveDelay;
  return { arrive, release, leaveStart, end: leaveStart + DROP.leaveTime };
}

/** Seconds for a unit to fall `h` metres from rest. */
export const fallTime = (h) => Math.sqrt(2 * Math.max(0, h) / DROP.gravity);

const easeOut = (u) => 1 - (1 - u) ** 3;
const easeIn = (u) => u * u;
const lerp = (a, b, u) => a + (b - a) * u;

/**
 * Ship position at time `t`. `hover`, `from` and `to` are {x, y, z}: it flies from `from` to `hover` (decelerating), waits, then leaves for `to` (accelerating).
 * Returns { x, y, z, phase: 'in' | 'hover' | 'out' | 'gone' }.
 */
export function shipPos(t, tl, from, hover, to) {
  if (t < tl.arrive) { const k = easeOut(Math.max(0, t) / tl.arrive); return { x: lerp(from.x, hover.x, k), y: lerp(from.y, hover.y, k), z: lerp(from.z, hover.z, k), phase: 'in' }; }
  if (t < tl.leaveStart) return { x: hover.x, y: hover.y, z: hover.z, phase: 'hover' };
  if (t < tl.end) { const k = easeIn((t - tl.leaveStart) / (tl.end - tl.leaveStart)); return { x: lerp(hover.x, to.x, k), y: lerp(hover.y, to.y, k), z: lerp(hover.z, to.z, k), phase: 'out' }; }
  return { x: to.x, y: to.y, z: to.z, phase: 'gone' };
}

/** The saved choice: on unless the player turned it off. `store` is anything with getItem (localStorage); a missing or throwing store means on. */
export const DROPSHIP_KEY = 'afterlight.dropships';
export function dropshipsEnabled(store) {
  try { return store?.getItem?.(DROPSHIP_KEY) !== '0'; } catch { return true; }
}
