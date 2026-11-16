// U25 "Crucible": the Crucible's own loot. Seven legendary weapons and the Crucible armor set for every class, in one crimson,
// gunmetal and bronze look. None of it is in a random pool: the weapons are not in LEGENDARY_WEAPONS, the set is left out of
// SET_IDS (style.js flag `crucible`). Only a finished Crucible match hands them out (js/crucible.js endMatch, one item per player).
import { makeWeapon, makeArmor } from './loot.js';
import { frameSlot } from './frames.js';

/** Blackened gunmetal, Crucible crimson panels, worn bronze trim (models.js exoticParts draws `crucible`). */
export const CRUCIBLE_LOOK = { body: 0x2b2d31, accent: 0xb07a3a, panel: 0xa3222a, glow: 0xff3a2e, parts: ['crucible'] };

/** Seven legendaries. The elements cover Kinetic, Arc, Solar and Void. */
export const CRUCIBLE_WEAPONS = [
  { name: 'Trust', arch: 'hand', frame: 'adaptive', element: 'arc', crucible: true },
  { name: "Redrix's Broadsword", arch: 'pulse', frame: 'rapid', element: 'kinetic', crucible: true },
  { name: 'Recluse', arch: 'smg', frame: 'precision', element: 'solar', crucible: true },
  { name: 'Jade Rabbit', arch: 'scout', frame: 'precision', element: 'void', crucible: true },
  { name: 'Revoker', arch: 'sniper', frame: 'adaptive', element: 'kinetic', crucible: true },
  { name: 'Cartesian Coordinate', arch: 'fusion', frame: 'rapid', element: 'arc', crucible: true },
  { name: 'The Mountaintop', arch: 'glauncher', frame: 'adaptive', element: 'solar', crucible: true },
];
export const CRUCIBLE_SET = 'crucible';

const pick = (a, rnd) => a[Math.floor(rnd() * a.length)];

/** A legendary from the pool at `power` (normal perk rolls). */
export function makeCrucibleWeapon(power, rnd = Math.random, entry = null) {
  const n = entry || pick(CRUCIBLE_WEAPONS, rnd);
  const it = makeWeapon(frameSlot(n.arch, n.frame), power, 3, n.arch, null, n);
  it.crucible = true;
  return it;
}
/** A legendary Crucible armor piece for `classId` (a random slot when none is given). */
export function makeCrucibleArmor(power, classId, rnd = Math.random, slot = null, band = 'base') {
  return makeArmor(slot || pick(['helmet', 'arms', 'chest', 'legs'], rnd), power, 3, CRUCIBLE_SET, classId, null, band);
}
/** The one item a finished match pays: a weapon or a piece of armor, even odds. */
export function makeCrucibleDrop(power, classId, rnd = Math.random, band = 'base') {
  return rnd() < 0.5 ? makeCrucibleWeapon(power, rnd) : makeCrucibleArmor(power, classId, rnd, null, band);
}
