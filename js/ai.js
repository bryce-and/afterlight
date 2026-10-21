// Enemy AI rules that need no scene (U13a): zone leash, cover eligibility, cover rhythm, close-range
// melee and suicide blast numbers. Kept pure so tools/tests.js can exercise them.

// ---- zone leash ----
// A unit never chases past its zone plus a margin. Zone activation is at 24 m (28 for a boss), so
// 34 m / 42 m leave 10 to 14 m of margin. A zone may carry its own `leash` radius or a closed `room`
// rectangle (arena zones); a room wins over the radius.
export const LEASH = { radius: 34, bossRadius: 42, slack: 2 };

export function leashRadius(zone) {
  return zone.leash ?? (zone.isBoss ? LEASH.bossRadius : LEASH.radius);
}

/** Nearest point inside the allowed area to (x, z), inset 1 m from its edge. */
export function insideLeash(zone, x, z) {
  const c = zone.center;
  if (zone.room) {
    const r = zone.room;
    return { x: Math.min(Math.max(x, r.minX + 1), r.maxX - 1), z: Math.min(Math.max(z, r.minZ + 1), r.maxZ - 1) };
  }
  const R = leashRadius(zone), dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
  return d <= R - 1 ? { x, z } : { x: c.x + (dx / d) * (R - 1), z: c.z + (dz / d) * (R - 1) };
}

/** True when (x, z) is past the leash (beyond `slack`). */
export function pastLeash(zone, x, z, slack = LEASH.slack) {
  const c = zone.center;
  if (zone.room) { const r = zone.room; return x < r.minX - slack || x > r.maxX + slack || z < r.minZ - slack || z > r.maxZ + slack; }
  return Math.hypot(x - c.x, z - c.z) > leashRadius(zone) + slack;
}

/** Where a unit should head given its real target: the target itself, or the nearest edge of its area when the target is out of reach. */
export function leashTarget(zone, tx, tz) {
  if (!zone?.center || !pastLeash(zone, tx, tz, 0)) return { x: tx, z: tz, held: false };
  const p = insideLeash(zone, tx, tz);
  return { x: p.x, z: p.z, held: true };
}

// ---- cover as a mechanic to play against ----
export const COVER = {
  hide: [1.3, 2.0],        // seconds behind cover between peeks
  peek: 3.2,               // longest a peek lasts
  bursts: 2,               // bursts fired per peek
  heavyNear: 12,           // a heavy this close means the squad pushes instead of hiding
  flushedFor: 4,           // after being flushed a unit won't look for cover again for this long
  recheck: 0.5,            // how often a hidden unit checks whether it has been flanked
};

/** Heavies and bosses never hide. Smaller units hide only when not outnumbered and no heavy is close. */
export function coverAllowed({ usesCover, aggro = 0, heavyNear = false, flushed = false }) {
  return !!usesCover && aggro < 3 && !heavyNear && !flushed;
}

// ---- close-range melee for gun units (V21) ----
// Any unit that can shoot can also hit you when you are inside `range`. Damage scales with the unit's size.
export const CLOSE_MELEE = {
  grunt: { range: 2.4, dmg: 14 },
  captain: { range: 2.7, dmg: 22 },
  heavy: { range: 3.4, dmg: 40 },
  boss: { range: 4.2, dmg: 55 },
  windup: 0.32, swing: 0.22, cooldown: 1.7,
};

/** Reach in metres from the unit centre for a close-range melee swing (the body radius is added so big units reach further). */
export function closeMeleeReach(typeId, radius) {
  const m = CLOSE_MELEE[typeId];
  return m ? m.range + radius * 0.5 : 0;
}

// ---- suicide units (V22) ----
export const SUICIDE = {
  trigger: 3.2,   // starts the fuse inside this distance
  fuse: 0.55,     // seconds from trigger to blast
  radius: 5,
  dmg: 42,
};

/** Blast damage at distance d: full in the core, half at the edge, none beyond. */
export function blastDamage(dmg, d, radius = SUICIDE.radius) {
  if (d >= radius) return 0;
  return dmg * (1 - 0.5 * (d / radius));
}
