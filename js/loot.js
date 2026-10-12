import { ARCHETYPES, RARITIES, RARITY_WEIGHTS, PERK_POOL, EXOTIC_WEAPONS, EXOTIC_ARMOR, ENERGY, SLOTS, WEAPON_SLOTS, HEAVY_VERSION } from './data.js';
import { pick, randInt, rand, weightedIndex } from './util.js';

export const MAX_POWER = 100;

const ADJ = ['Ashen', 'Iron', 'Silent', 'Crimson', 'Hollow', 'Vigil', 'Dusk', 'Ember', 'Pale', 'Broken', 'Storm', 'Grave', 'Gilded', 'Wayward', 'Bitter', 'Sable', 'Lucent', 'Feral', 'Errant', 'Last'];
const NOUN = ['Oath', 'Promise', 'Requiem', 'Verdict', 'Covenant', 'Lament', 'Sentinel', 'Herald', 'Reckoning', 'Psalm', 'Edict', 'Tide', 'Mercy', 'Vow', 'Witness', 'Ruin', 'Hymn', 'Answer', 'Warden', 'Dirge'];
const PLACE = ['the Deep', 'Dawn', 'the Ninth Sun', 'the Pale Moon', 'the Ash Wastes', 'Quiet Stars', 'the Long Night'];
const FOUNDRY = ['Häkke', 'Omolon', 'SUROS', 'VEIST', 'Daito', 'Tex Mechanica', 'Field Forged'];
const CODE = { auto: 'AR', hand: 'HC', pulse: 'PR', scout: 'SR', smg: 'SMG', shotgun: 'SG', sniper: 'SN', fusion: 'FR', linear: 'LFR', rocket: 'RL', mg: 'MG', glauncher: 'GL' };
const LEGENDARY = {
  auto: ['Shadow Price', 'Doctrine of Passing', "Uriel's Gift", 'Gnawing Hunger', 'Age-Old Bond', 'Chattering Bone'],
  hand: ['Fatebringer', 'Palindrome', 'Midnight Coup', 'Igneous Hammer', 'Not Forgotten', "Luna's Howl"],
  pulse: ['Bygones', 'Blast Furnace', 'Messenger', 'Vouchsafe', 'Inaugural Address', 'Outlast'],
  scout: ['Nameless Midnight', "Shepherd's Watch", 'Vision of Confluence', 'Night Watch', 'Hung Jury SR4', 'Randy\'s Throwing Knife'],
  smg: ['Recluse', 'Multimach CCX', 'Funnelweb', "Shayura's Wrath", 'IKELOS_SMG_v1.0.3', 'The Title'],
  shotgun: ["Felwinter's Lie", 'The Comedian', "Mindbender's Ambition", 'Matador 64', 'Astral Horizon', 'Heritage'],
  sniper: ['Beloved', '1000 Yard Stare', 'Supremacy', 'Revoker', 'Eye of Sol', "Praedyth's Revenge"],
  fusion: ['Main Ingredient', 'Plug One.1', 'Glacioclasm', 'Exalted Truth', 'Pre Astyanax IV', 'Loaded Question'],
  linear: ['Taipan-4fr', 'Stormchaser', "Briar's Contempt", 'Cataclysmic', "Reed's Regret", 'Fire and Forget'],
  rocket: ['Hezen Vengeance', "Tomorrow's Answer", 'Hothead', 'Bad Omens', 'Apex Predator', 'Crowning Duologue'],
  mg: ['Hammerhead', 'Fixed Odds', "Qullim's Terminus", "Archon's Thunder", 'Corrective Measure', 'Commemoration'],
  glauncher: ['Wendigo GL3', 'Ignition Code', 'Tarnation', 'Edge Transit', 'Hullabaloo', 'Regnant'],
};
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

/** bonus 0..12 shifts weight toward higher rarities. */
export function rollRarityIdx(bonus = 0) {
  const w = RARITY_WEIGHTS.map((x, i) => (i === 0 ? Math.max(4, x - bonus * 3) : x * (1 + bonus * 0.12 * i)));
  return weightedIndex(w);
}

function weaponName(rIdx, arch) {
  if (rIdx === 0) return `${pick(FOUNDRY)} ${CODE[arch]}-${randInt(2, 9)}`;
  if (rIdx === 3) return pick(LEGENDARY[arch]);
  if (rIdx === 2 && Math.random() < 0.3) return `${pick(NOUN)} of ${pick(PLACE)}`;
  return `${pick(ADJ)} ${pick(NOUN)}`;
}

const clampPower = (p) => Math.max(1, Math.min(MAX_POWER, Math.round(p)));

const MOD_REPLACE = ['mode', 'burst', 'burstDelay', 'pellets', 'charge'];

export function makeWeapon(slot, power, rIdx, archOverride, exoticName = null) {
  const rar = RARITIES[rIdx];
  let arch, element, name, exotic = null, flavor = '', tpl = null;
  if (rar.id === 'exotic') {
    const pool = EXOTIC_WEAPONS.filter((e) => (e.slot || ARCHETYPES[e.arch].slot) === slot);
    tpl = (exoticName && EXOTIC_WEAPONS.find((e) => e.name === exoticName)) || pick(pool);
    arch = tpl.arch; element = tpl.element; name = tpl.name; exotic = tpl.perks[0]; flavor = tpl.flavor;
  } else {
    arch = archOverride || pick(Object.values(ARCHETYPES).filter((a) => a.slot === slot)).id;
    element = slot === 'primary' ? (Math.random() < 0.6 ? 'kinetic' : pick(ENERGY)) : pick(ENERGY);
    name = weaponName(rIdx, arch);
  }
  const A = ARCHETYPES[arch];
  const roll = (lo, hi) => rand(lo, hi);
  const stats = {
    dmg: +(A.dmg * rar.mult * roll(0.94, 1.06)).toFixed(1),
    rpm: Math.round(A.rpm * roll(0.95, 1.05)),
    mag: Math.max(1, Math.round(A.mag * roll(0.9, 1.15))),
    reload: +(A.reload * roll(0.88, 1.08)).toFixed(2),
    spread: A.spread * roll(0.9, 1.1),
    range: Math.round(A.range * roll(0.9, 1.12)),
  };
  if (A.mag === 1) stats.mag = 1;
  const perks = [];
  let mods = null;
  if (tpl) {
    // exotics: fixed signature perks and their own handling
    mods = {};
    for (const [k, v] of Object.entries(tpl.mods || {})) {
      if (MOD_REPLACE.includes(k)) mods[k] = v;
      else if (k in stats) stats[k] = k === 'mag' || k === 'rpm' ? Math.max(1, Math.round(stats[k] * v)) : +(stats[k] * v).toFixed(k === 'spread' ? 4 : 1);
    }
  } else {
    const pool = PERK_POOL[slot].filter((p) => !(p === 'extmag' && A.mag === 1));
    while (perks.length < rar.perks && perks.length < pool.length) {
      const p = pick(pool);
      if (!perks.includes(p)) perks.push(p);
    }
  }
  const item = { id: newId(), kind: 'weapon', slot: tpl?.slot || slot, arch, element, rarity: rar.id, name, power: clampPower(power), stats, perks, exotic, flavor, isNew: true };
  if (tpl) { item.exoticPerks = [...tpl.perks]; item.mods = mods; }
  if (item.slot !== A.slot) heavyVersion(item);
  return item;
}

/** A specific exotic by name (used to upgrade exotics from older saves). */
export function makeExotic(name, power) {
  const tpl = EXOTIC_WEAPONS.find((e) => e.name === name);
  if (!tpl) return null;
  return makeWeapon(tpl.slot || ARCHETYPES[tpl.arch].slot, power, 4, null, name);
}

export function makeArmor(slot, power, rIdx) {
  const rar = RARITIES[rIdx];
  const total = rar.armorPts + randInt(-1, 2);
  const a = Math.random(), b = Math.random(), c = Math.random(), s = a + b + c;
  let mob = Math.round((a / s) * total), res = Math.round((b / s) * total);
  let rec = Math.max(0, total - mob - res);
  let name;
  if (rar.id === 'exotic') name = pick(EXOTIC_ARMOR[slot]);
  else if (rIdx === 0) name = `${pick(MAKERS)} ${pick(ARMOR_NOUN[slot])}`;
  else name = `${pick(ADJ)} ${pick(ARMOR_NOUN[slot])}`;
  return { id: newId(), kind: 'armor', slot, rarity: rar.id, name, power: clampPower(power), stats: { mob, res, rec }, isNew: true };
}

export function rollItem(power, rIdx, slot = pick(SLOTS)) {
  return WEAPON_SLOTS.includes(slot) ? makeWeapon(slot, power, rIdx) : makeArmor(slot, power, rIdx);
}

export function starterGear() {
  const p = makeWeapon('primary', 10, 0, 'auto'); p.name = 'Khvostov 7G-02'; p.element = 'kinetic';
  const s = makeWeapon('special', 8, 0, 'shotgun'); s.name = 'Häkke SG-3';
  const h = makeWeapon('heavy', 8, 0, 'rocket'); h.name = 'Omolon RL-2';
  const armor = ['helmet', 'arms', 'chest', 'legs'].map((sl) => makeArmor(sl, 10, 0));
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
  item.slot = 'heavy';
  item.stats.dmg = +(item.stats.dmg * HEAVY_VERSION.dmg).toFixed(1);
  item.reserve = HEAVY_VERSION.reserve;
  item.brick = HEAVY_VERSION.brick;
  return item;
}

/** Renames gear from older saves to the Destiny names (keeps stats and perks). */
export function modernizeItem(it) {
  if (it.kind === 'armor') { if (it.rarity === 'exotic' && !EXOTIC_ARMOR[it.slot].includes(it.name)) it.name = EXOTIC_ARMOR[it.slot][0]; return; }
  if (it.rarity === 'exotic') {
    const tpl = EXOTIC_WEAPONS.find((e) => e.arch === it.arch);
    if (tpl) Object.assign(it, { name: tpl.name, element: tpl.element, exotic: tpl.perks[0], flavor: tpl.flavor });
  } else if (it.rarity === 'legendary') it.name = pick(LEGENDARY[it.arch]);
  else if (it.rarity === 'common') it.name = `${pick(FOUNDRY)} ${CODE[it.arch]}-${randInt(2, 9)}`;
}

export function dismantleValue(it) {
  return [5, 12, 30, 70, 160][RARITIES.findIndex((r) => r.id === it.rarity)] + it.power;
}
