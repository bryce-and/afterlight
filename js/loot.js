import { ARCHETYPES, RARITIES, PERK_POOL, EXOTIC_WEAPONS, EXOTIC_ARMOR, exoticArmorFor, ENERGY, SLOTS, WEAPON_SLOTS, HEAVY_VERSION } from './data.js';
import { pick, randInt } from './util.js';
import { LIGHT_CAP } from './progression.js';
import { ARMOR_TOTAL, rollStats, blankMods } from './armor.js';
import { framesFor, legendariesFor, weaponStats } from './frames.js';
import { SETS, setForDrop } from './style.js';

const ADJ = ['Ashen', 'Iron', 'Silent', 'Crimson', 'Hollow', 'Vigil', 'Dusk', 'Ember', 'Pale', 'Broken', 'Storm', 'Grave', 'Gilded', 'Wayward', 'Bitter', 'Sable', 'Lucent', 'Feral', 'Errant', 'Last'];
const NOUN = ['Oath', 'Promise', 'Requiem', 'Verdict', 'Covenant', 'Lament', 'Sentinel', 'Herald', 'Reckoning', 'Psalm', 'Edict', 'Tide', 'Mercy', 'Vow', 'Witness', 'Ruin', 'Hymn', 'Answer', 'Warden', 'Dirge'];
const PLACE = ['the Deep', 'Dawn', 'the Ninth Sun', 'the Pale Moon', 'the Ash Wastes', 'Quiet Stars', 'the Long Night'];
const FOUNDRY = ['Häkke', 'Omolon', 'SUROS', 'VEIST', 'Daito', 'Tex Mechanica', 'Field Forged'];
const CODE = { auto: 'AR', hand: 'HC', pulse: 'PR', scout: 'SR', smg: 'SMG', shotgun: 'SG', sniper: 'SN', fusion: 'FR', linear: 'LFR', rocket: 'RL', mg: 'MG', glauncher: 'GL' };
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

function weaponName(rIdx, arch) {
  if (rIdx === 0) return `${pick(FOUNDRY)} ${CODE[arch]}-${randInt(2, 9)}`;
  if (rIdx === 2 && Math.random() < 0.3) return `${pick(NOUN)} of ${pick(PLACE)}`;
  return `${pick(ADJ)} ${pick(NOUN)}`;
}

const clampPower = (p) => Math.max(1, Math.min(LIGHT_CAP, Math.round(p)));

const MOD_REPLACE = ['mode', 'burst', 'burstDelay', 'pellets', 'charge'];

export function makeWeapon(slot, power, rIdx, archOverride, exoticName = null) {
  const rar = RARITIES[rIdx];
  let arch, element, name, frame = null, exotic = null, flavor = '', tpl = null;
  if (rar.id === 'exotic') {
    const pool = EXOTIC_WEAPONS.filter((e) => (e.slot || ARCHETYPES[e.arch].slot) === slot);
    tpl = (exoticName && EXOTIC_WEAPONS.find((e) => e.name === exoticName)) || pick(pool);
    arch = tpl.arch; element = tpl.element; name = tpl.name; exotic = tpl.perks[0]; flavor = tpl.flavor;
  } else {
    arch = archOverride || pick(Object.values(ARCHETYPES).filter((a) => a.slot === slot)).id;
    if (rar.id === 'legendary') {
      // named legendaries always have the same archetype and element
      const leg = pick(legendariesFor(arch));
      ({ name, frame, element } = leg);
    } else {
      element = slot === 'primary' ? (Math.random() < 0.6 ? 'kinetic' : pick(ENERGY)) : pick(ENERGY);
      name = weaponName(rIdx, arch);
      frame = pick(framesFor(arch)); // rolled once, then part of the weapon for good
    }
  }
  const A = ARCHETYPES[arch];
  const perks = [];
  let mods = null;
  if (tpl) {
    // exotics: fixed signature perks and their own handling
    mods = {};
    for (const [k, v] of Object.entries(tpl.mods || {})) if (MOD_REPLACE.includes(k)) mods[k] = v;
  } else {
    const pool = PERK_POOL[slot].filter((p) => !(p === 'extmag' && A.mag === 1));
    while (perks.length < rar.perks && perks.length < pool.length) {
      const p = pick(pool);
      if (!perks.includes(p)) perks.push(p);
    }
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
  const p = makeWeapon('primary', 10, 0, 'auto'); p.name = 'Khvostov 7G-02'; p.element = 'kinetic';
  const s = makeWeapon('special', 8, 0, 'shotgun'); s.name = 'Häkke SG-3';
  const h = makeWeapon('heavy', 8, 0, 'rocket'); h.name = 'Omolon RL-2';
  const armor = ['helmet', 'arms', 'chest', 'legs'].map((sl) => makeArmor(sl, 10, 0, null, classId));
  return [p, s, h, ...armor].map((it) => ({ ...it, isNew: false }));
}

const ARMORY_NAMES = { auto: 'Khvostov 7G-02', hand: 'Häkke HC-4', pulse: 'SUROS PR-3', scout: 'Omolon SR-5', smg: 'VEIST SMG-2', shotgun: 'Häkke SG-3', sniper: 'Daito SN-6', fusion: 'Omolon FR-4', linear: 'Daito LFR-5', rocket: 'Omolon RL-2', mg: 'Häkke MG-6', glauncher: 'Tex Mechanica GL-4' };

/** One common weapon of every archetype the player doesn't already own. */
export function armoryGear(owned, power) {
  return Object.values(ARCHETYPES)
    .filter((A) => !owned.has(A.id))
    .map((A) => ({ ...makeWeapon(A.slot, power, 0, A.id), name: ARMORY_NAMES[A.id] ?? A.name }));
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
