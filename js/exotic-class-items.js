// U27 Prismatic: exotic class items (Essentialism cloak, Stoicism mark, Solipsism bond). Pure rules, so tools/tests.html can check them.
// Each drop rolls two different "Spirit of ..." perks copied from that class's exotic armor (EXOTIC_ARMOR_PERKS entries marked
// `spirit: true`), so one piece carries two exotic effects at once. They work only while a Prismatic subclass is equipped; on any other
// subclass the item gives stats only. It is the exotic armor piece, so the one-exotic rule covers it (save.js ARMOR_SLOTS).
import { EXOTIC_ARMOR, EXOTIC_ARMOR_PERKS } from './data.js';

export const EXOTIC_CLASS_ITEMS = { stalker: 'Essentialism', vanguard: 'Stoicism', arcanist: 'Solipsism' };
export const isExoticClassItem = (it) => !!it && it.kind === 'armor' && it.slot === 'classitem' && it.rarity === 'exotic';

/** The exotic armor names whose perk this class's class item can copy. */
export function spiritPool(classId) {
  return Object.values(EXOTIC_ARMOR[classId]).flat().filter((name) => EXOTIC_ARMOR_PERKS[name]?.spirit);
}
/** "Spirit of <armor name>": what the perk is called on the item. */
export const spiritName = (armorName) => `Spirit of ${armorName}`;

/** Two different Spirit perks for a new exotic class item (the armor names they come from). `rnd` makes it testable. loot.js makeArmor calls this. */
export function rollSpirits(classId, rnd = Math.random) {
  const pool = spiritPool(classId);
  const a = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
  const b = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
  return [a, b];
}
/** The perk ids an exotic class item grants (the Player merges them into `exo`). Empty for anything else. */
export function spiritPerks(it) {
  if (!isExoticClassItem(it) || !Array.isArray(it.spirits)) return [];
  return it.spirits.map((n) => EXOTIC_ARMOR_PERKS[n]?.id).filter(Boolean);
}
/** The perk entries (for a tooltip): [{ title, name, desc }]. */
export function spiritEntries(it) {
  if (!isExoticClassItem(it) || !Array.isArray(it.spirits)) return [];
  return it.spirits.filter((n) => EXOTIC_ARMOR_PERKS[n]).map((n) => ({ title: spiritName(n), name: EXOTIC_ARMOR_PERKS[n].name, desc: EXOTIC_ARMOR_PERKS[n].desc }));
}
