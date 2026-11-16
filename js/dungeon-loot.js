// U23 "The Emperor's Shadow": the dungeon's own loot. Six legendary weapons with the Imperial look and an exclusive perk, the
// Imperial armor set for every class, the "Emperor's Shadow" shader and the exotic Sovereign's Gaze. None of it is in a random
// pool: legendaries are not in LEGENDARY_WEAPONS, the set is left out of SET_IDS, the shader out of SHADER_IDS, and the exotic
// (data.js, `dungeon: 'shadow'`) out of EXOTIC_RANDOM_WEAPONS. Only js/dungeon.js hands them out.
import { makeWeapon, makeArmor, makeExotic } from './loot.js';
import { frameSlot } from './frames.js';

/** Every weapon of the pool rolls the usual legendary perks plus one of these (PERKS in data.js, marked `exclusive`). */
export const DUNGEON_PERKS = ['gildedtithe', 'tastersinstinct', 'emperorsfeast', 'royalguard', 'psionicecho', 'banquetrush'];
/** Tuning for the exclusive perks (js/player.js reads it). */
export const IMPERIAL_TUNE = {
  titheStacks: 5, titheDmg: 1.15, titheT: 6, // Gilded Tithe: precision kills build stacks; at 5, a reload and +15% damage
  instinctDmg: 1.15, instinctT: 8, // Taster's Instinct: Favor or an orb reloads and adds damage
  feastHeal: 0.2, feastT: 2, feastMax: 3, // Emperor's Feast: kills heal 20% over 2 s, up to 3 at once
  guardCut: 0.75, // Royal Guard: 25% less damage on a plate or dais
  echoEvery: 5, echoR: 5, echoDmg: 0.3, // Psionic Echo: every 5th hit pulses for 30% of the hit
  rushT: 5, rushReload: 0.6, // Banquet Rush: kills speed up the next reloads for 5 s
};

/** White marble, gold filigree, a purple glow (models.js exoticParts draws `filigree` and `gem`). */
export const IMPERIAL_LOOK = { body: 0xe9e2d2, accent: 0xd9a520, glow: 0xa060ff, parts: ['filigree', 'gem'] };

export const DUNGEON_WEAPONS = [
  { name: 'Gilded Decree', arch: 'hand', frame: 'adaptive', element: 'kinetic', dungeon: 'shadow' },
  { name: 'Royal Pardon', arch: 'pulse', frame: 'highimpact', element: 'void', dungeon: 'shadow' },
  { name: 'Feastbreaker', arch: 'shotgun', frame: 'precision', element: 'solar', dungeon: 'shadow' },
  { name: "The Taster's Due", arch: 'smg', frame: 'adaptive', element: 'arc', dungeon: 'shadow' },
  { name: 'Throneward', arch: 'sniper', frame: 'aggressive', element: 'kinetic', dungeon: 'shadow' },
  { name: 'Last Course', arch: 'rocket', frame: 'precision', element: 'solar', dungeon: 'shadow' },
];
export const DUNGEON_EXOTIC = "Sovereign's Gaze";
export const DUNGEON_SET = 'imperial';
export const DUNGEON_SHADER = 'emperorsShadow';

const pick = (a, rnd) => a[Math.floor(rnd() * a.length)];

/** A legendary from the pool at `power`: its normal perks plus one exclusive perk. */
export function makeDungeonWeapon(power, rnd = Math.random, entry = null) {
  const n = entry || pick(DUNGEON_WEAPONS, rnd);
  const it = makeWeapon(frameSlot(n.arch, n.frame), power, 3, n.arch, null, n);
  it.perks = [...it.perks, pick(DUNGEON_PERKS, rnd)];
  it.dungeon = n.dungeon;
  return it;
}
/** A legendary Imperial armor piece for `classId` (a random slot when none is given). */
export function makeDungeonArmor(power, classId, rnd = Math.random, slot = null, band = 'base') {
  return makeArmor(slot || pick(['helmet', 'arms', 'chest', 'legs'], rnd), power, 3, DUNGEON_SET, classId, null, band);
}
export function makeDungeonExotic(power) {
  const it = makeExotic(DUNGEON_EXOTIC, power);
  if (!it) throw new Error(`Dungeon exotic "${DUNGEON_EXOTIC}" is missing from EXOTIC_WEAPONS`);
  return it;
}
/** The drop for one `clearDrops` entry ('weapon' | 'armor' | 'exotic'); the shader is not an item (dungeon.js grants it). */
export function makeDungeonDrop(kind, power, classId, rnd = Math.random, band = 'base') {
  if (kind === 'weapon') return makeDungeonWeapon(power, rnd);
  if (kind === 'armor') return makeDungeonArmor(power, classId, rnd, null, band);
  if (kind === 'exotic') return makeDungeonExotic(power);
  throw new Error(`No dungeon drop of kind "${kind}"`);
}
