import { ARCHETYPES, RARITIES, EXOTIC_WEAPONS, EXOTIC_ARMOR, exoticArmorFor, SLOTS, WEAPON_SLOTS, HEAVY_VERSION } from './data.js';
import { pick, randInt } from './util.js';
import { LIGHT_CAP } from './progression.js';
import { ARMOR_TOTAL, rollStats, blankMods } from './armor.js';
import { namedFor, perkPoolFor, rollPerks, weaponStats } from './frames.js';
import { SETS, setForDrop } from './style.js';

const ADJ = ['Ashen', 'Iron', 'Silent', 'Crimson', 'Hollow', 'Vigil', 'Dusk', 'Ember', 'Pale', 'Broken', 'Storm', 'Grave', 'Gilded', 'Wayward', 'Bitter', 'Sable', 'Lucent', 'Feral', 'Errant', 'Last'];
const NOUN = ['Oath', 'Promise', 'Requiem', 'Verdict', 'Covenant', 'Lament', 'Sentinel', 'Herald', 'Reckoning', 'Psalm', 'Edict', 'Tide', 'Mercy', 'Vow', 'Witness', 'Ruin', 'Hymn', 'Answer', 'Warden', 'Dirge'];
const MAKERS = ['Field', 'Scout', 'Patrol', 'Trooper', 'Ranger'];
const ARMOR_NOUN = {
  helmet: ['Helm', 'Mask', 'Visor', 'Hood', 'Cowl'],
  arms: ['Gauntlets', 'Grips', 'Bracers', 'Gloves'],
  chest: ['Plate', 'Vest', 'Cuirass', 'Robes', 'Harness'],
  legs: ['Greaves', 'Strides', 'Boots', 'Treads'],
};

export function newId() {
  return Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 9);
}


const clampPower = (p) => Math.max(1, Math.min(LIGHT_CAP, Math.round(p)));

const MOD_REPLACE = ['mode', 'burst', 'burstDelay', 'pellets', 'charge'];

export function makeWeapon(slot, power, rIdx, archOverride, exoticName = null) {
  const rar = RARITIES[rIdx];
  let arch, element, name, frame = null, exotic = null, flavor = '', tpl = null, named = null;
  if (rar.id === 'exotic') {
    const pool = EXOTIC_WEAPONS.filter((e) => (e.slot || ARCHETYPES[e.arch].slot) === slot);
    tpl = (exoticName && EXOTIC_WEAPONS.find((e) => e.name === exoticName)) || pick(pool);
    arch = tpl.arch; element = tpl.element; name = tpl.name; exotic = tpl.perks[0]; flavor = tpl.flavor;
  } else {
    arch = archOverride || pick(Object.values(ARCHETYPES).filter((a) => a.slot === slot)).id;
    // Loot 2.0: every rarity is a named weapon with a fixed archetype and element
    named = pick(namedFor(arch, rar.id));
    if (!named) throw new Error(`makeWeapon: no ${rar.id} named weapon for ${arch}`);
    ({ name, frame, element } = named);
  }
  const A = ARCHETYPES[arch];
  let perks = [];
  let mods = null;
  if (tpl) {
    // exotics: fixed signature perks and their own handling
    mods = {};
    for (const [k, v] of Object.entries(tpl.mods || {})) if (MOD_REPLACE.includes(k)) mods[k] = v;
  } else {
    perks = rollPerks(perkPoolFor(named), rar.id);
  }
  const item = { id: newId(), kind: 'weapon', slot: tpl?.slot || slot, arch, frame, element, rarity: rar.id, name, power: clampPower(power), stats: null, perks, exotic, flavor, isNew: true };
  if (tpl) { item.exoticPerks = [...tpl.perks]; item.mods = mods; }
  item.stats = weaponStats(item); // includes the heavy-slot damage bonus
  if (item.slot !== A.slot) heavyVersion(item);
  return item;
}

/** A specific exotic by name (used to upgrade exotics from older saves). */
export function makeExotic(name, power) {
  const tpl = EXOTIC_WEAPONS.find((e) => e.name === name);
  if (!tpl) return null;
  return makeWeapon(tpl.slot || ARCHETYPES[tpl.arch].slot, power, 4, null, name);
}

/** `dest`: the destination the drop comes from (a location id); legendaries are that destination's set. `classId`: who can wear it. `exoticName`: a specific exotic. */
export function makeArmor(slot, power, rIdx, dest = null, classId = null, exoticName = null) {
  const rar = RARITIES[rIdx];
  const stats = rollStats(ARMOR_TOTAL[rar.id] + randInt(-2, 2));
  let name, set = null;
  if (rar.id === 'exotic') { classId = classId || pick(Object.keys(EXOTIC_ARMOR)); name = exoticName || pick(EXOTIC_ARMOR[classId][slot]); } // exotics exist for one class
  else if (rar.id === 'legendary') { set = setForDrop(dest); name = SETS[set].pieces[slot]; }
  else if (rIdx === 0) name = `${pick(MAKERS)} ${pick(ARMOR_NOUN[slot])}`;
  else name = `${pick(ADJ)} ${pick(ARMOR_NOUN[slot])}`;
  // Armor 2.0: no perks. Four sockets for mods (the first takes stat mods), filled by the player.
  const it = { id: newId(), kind: 'armor', slot, classId, rarity: rar.id, name, power: clampPower(power), stats, mods: blankMods(), isNew: true };
  if (set) it.set = set;
  return it;
}

// Duplicate protection: an exotic the player has already found is this much less likely
// than one they haven't. Once every exotic in the pool is found, all are equally likely again.
export const EXOTIC_REPEAT_WEIGHT = 0.15;

/** Drop weight of each exotic name, given the names already found. */
export function exoticWeights(names, found = []) {
  const have = new Set(found);
  const complete = names.every((n) => have.has(n));
  return names.map((n) => (!complete && have.has(n) ? EXOTIC_REPEAT_WEIGHT : 1));
}

/** Picks one exotic name, favoring ones not found yet. */
export function pickExotic(names, found = [], rnd = Math.random) {
  const w = exoticWeights(names, found);
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < names.length; i++) { r -= w[i]; if (r < 0) return names[i]; }
  return names[names.length - 1];
}

/**
 * A drop. `slot` null rolls one (so weapons vs armor keep their usual split). `found`: exotic names
 * the player already has (save.exoticsFound); an exotic drop then favors ones not found yet. Weapon
 * exotics are one pool for every Guardian; armor exotics are the class's pool. A given slot limits the pool.
 */
export function rollItem(power, rIdx, slot = null, dest = null, classId = null, found = []) {
  const fixed = !!slot;
  slot = slot || pick(SLOTS);
  const weapon = WEAPON_SLOTS.includes(slot);
  if (RARITIES[rIdx].id === 'exotic') {
    if (weapon) {
      const pool = EXOTIC_WEAPONS.filter((e) => !fixed || (e.slot || ARCHETYPES[e.arch].slot) === slot).map((e) => e.name);
      return makeExotic(pickExotic(pool, found), power);
    }
    classId = classId || pick(Object.keys(EXOTIC_ARMOR));
    const pool = exoticArmorFor(classId).filter((x) => !fixed || x.slot === slot);
    const name = pickExotic(pool.map((x) => x.name), found);
    return makeArmor(pool.find((x) => x.name === name).slot, power, rIdx, dest, classId, name);
  }
  return weapon ? makeWeapon(slot, power, rIdx) : makeArmor(slot, power, rIdx, dest, classId);
}

export function starterGear(classId = null) {
  // commons are named weapons since Loot 2.0: Khvostov 7G-02, Häkke SG-3 and Tumbril RL1
  const p = makeWeapon('primary', 10, 0, 'auto');
  const s = makeWeapon('special', 8, 0, 'shotgun');
  const h = makeWeapon('heavy', 8, 0, 'rocket');
  const armor = ['helmet', 'arms', 'chest', 'legs'].map((sl) => makeArmor(sl, 10, 0, null, classId));
  return [p, s, h, ...armor].map((it) => ({ ...it, isNew: false }));
}

/** One common weapon of every archetype the player doesn't already own. */
export function armoryGear(owned, power) {
  return Object.values(ARCHETYPES)
    .filter((A) => !owned.has(A.id))
    .map((A) => makeWeapon(A.slot, power, 0, A.id));
}

/** A special weapon type living in the Heavy slot: more damage, less ammo. */
export function heavyVersion(item) {
  if (item.reserve) return item; // already converted
  item.slot = 'heavy'; // damage: weaponStats applies HEAVY_VERSION.dmg for the heavy slot
  item.reserve = HEAVY_VERSION.reserve;
  item.brick = HEAVY_VERSION.brick;
  return item;
}

export function dismantleValue(it) {
  return [5, 12, 30, 70, 160][RARITIES.findIndex((r) => r.id === it.rarity)] + it.power;
}
