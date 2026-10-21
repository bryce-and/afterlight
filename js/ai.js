// Enemy AI rules that need no scene (U13a): room containment, cover eligibility, cover rhythm, close-range
// melee and suicide blast numbers. Kept pure so tools/tests.js can exercise them.

// ---- zone containment ----
// U16b: the open-zone leash is gone (playtesting: units held at an invisible edge felt bad). Units chase
// wherever the nav grid lets them. Only a closed `room` (arena and boss rooms) still contains its units.
// `leash` / `LEASH` names stay so callers keep working: they now mean "the room, if the zone has one".
export const LEASH = { radius: Infinity, bossRadius: Infinity, slack: 2 };

export function leashRadius(zone) {
  return zone.leash ?? (zone.isBoss ? LEASH.bossRadius : LEASH.radius);
}

/** Nearest point inside the room to (x, z), inset 1 m from its edge. Zones without a room contain nobody. */
export function insideLeash(zone, x, z) {
  if (!zone.room) return { x, z };
  const r = zone.room;
  return { x: Math.min(Math.max(x, r.minX + 1), r.maxX - 1), z: Math.min(Math.max(z, r.minZ + 1), r.maxZ - 1) };
}

/** True when (x, z) is outside the zone's room (beyond `slack`). Always false without a room. */
export function pastLeash(zone, x, z, slack = LEASH.slack) {
  if (!zone.room) return false;
  const r = zone.room;
  return x < r.minX - slack || x > r.maxX + slack || z < r.minZ - slack || z > r.maxZ + slack;
}

/** Where a unit should head given its real target: the target itself, or the nearest point of its room when the target is outside it. */
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
// U13b: the blast's core damage now comes from tiers.js suicideCore (a share of the Guardian's health and shield); `dmg` is kept for reference.
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
