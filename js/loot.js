import { ARCHETYPES, RARITIES, RARITY_WEIGHTS, PERK_POOL, EXOTIC_WEAPONS, EXOTIC_ARMOR, ENERGY, SLOTS, WEAPON_SLOTS } from './data.js';
import { pick, randInt, rand, weightedIndex } from './util.js';

export const MAX_POWER = 100;

const ADJ = ['Ashen', 'Iron', 'Silent', 'Crimson', 'Hollow', 'Vigil', 'Dusk', 'Ember', 'Pale', 'Broken', 'Storm', 'Grave', 'Gilded', 'Wayward', 'Bitter', 'Sable', 'Lucent', 'Feral', 'Errant', 'Last'];
const NOUN = ['Oath', 'Promise', 'Requiem', 'Verdict', 'Covenant', 'Lament', 'Sentinel', 'Herald', 'Reckoning', 'Psalm', 'Edict', 'Tide', 'Mercy', 'Vow', 'Witness', 'Ruin', 'Hymn', 'Answer', 'Warden', 'Dirge'];
const PLACE = ['the Deep', 'Dawn', 'the Ninth Sun', 'the Pale Moon', 'the Ash Wastes', 'Quiet Stars', 'the Long Night'];
const COMMON = ['Kestrel', 'Harrow', 'Tolland', 'Vesper', 'Breakline', 'Halcyon', 'Marrow', 'Sigil'];
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

function weaponName(rIdx) {
  if (rIdx === 0) return `${pick(COMMON)}-${randInt(2, 9)}`;
  if (rIdx === 3 && Math.random() < 0.5) return `${pick(NOUN)} of ${pick(PLACE)}`;
  return `${pick(ADJ)} ${pick(NOUN)}`;
}

const clampPower = (p) => Math.max(1, Math.min(MAX_POWER, Math.round(p)));

export function makeWeapon(slot, power, rIdx, archOverride) {
  const rar = RARITIES[rIdx];
  let arch, element, name, exotic = null, flavor = '';
  if (rar.id === 'exotic') {
    const pool = EXOTIC_WEAPONS.filter((e) => ARCHETYPES[e.arch].slot === slot);
    const tpl = pick(pool);
    arch = tpl.arch; element = tpl.element; name = tpl.name; exotic = tpl.perk; flavor = tpl.flavor;
  } else {
    arch = archOverride || pick(Object.values(ARCHETYPES).filter((a) => a.slot === slot)).id;
    element = slot === 'primary' ? (Math.random() < 0.6 ? 'kinetic' : pick(ENERGY)) : pick(ENERGY);
    name = weaponName(rIdx);
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
  const pool = PERK_POOL[slot].filter((p) => !(p === 'extmag' && A.mag === 1));
  const perks = [];
  while (perks.length < rar.perks && perks.length < pool.length) {
    const p = pick(pool);
    if (!perks.includes(p)) perks.push(p);
  }
  return { id: newId(), kind: 'weapon', slot, arch, element, rarity: rar.id, name, power: clampPower(power), stats, perks, exotic, flavor, isNew: true };
}

export function makeArmor(slot, power, rIdx) {
  const rar = RARITIES[rIdx];
  const total = rar.armorPts + randInt(-1, 2);
  const a = Math.random(), b = Math.random(), c = Math.random(), s = a + b + c;
  let mob = Math.round((a / s) * total), res = Math.round((b / s) * total);
  let rec = Math.max(0, total - mob - res);
  let name;
  if (rar.id === 'exotic') name = EXOTIC_ARMOR[slot];
  else if (rIdx === 0) name = `${pick(MAKERS)} ${pick(ARMOR_NOUN[slot])}`;
  else name = `${pick(ADJ)} ${pick(ARMOR_NOUN[slot])}`;
  return { id: newId(), kind: 'armor', slot, rarity: rar.id, name, power: clampPower(power), stats: { mob, res, rec }, isNew: true };
}

export function rollItem(power, rIdx, slot = pick(SLOTS)) {
  return WEAPON_SLOTS.includes(slot) ? makeWeapon(slot, power, rIdx) : makeArmor(slot, power, rIdx);
}

export function starterGear() {
  const p = makeWeapon('primary', 10, 0, 'auto'); p.name = 'Kestrel-7'; p.element = 'kinetic';
  const s = makeWeapon('special', 8, 0, 'shotgun'); s.name = 'Breakline-3';
  const h = makeWeapon('heavy', 8, 0, 'rocket'); h.name = 'Tolland-2';
  const armor = ['helmet', 'arms', 'chest', 'legs'].map((sl) => makeArmor(sl, 10, 0));
  return [p, s, h, ...armor].map((it) => ({ ...it, isNew: false }));
}

const ARMORY_NAMES = { auto: 'Kestrel-7', hand: 'Harrow Mk.2', pulse: 'Vesper-3', scout: 'Halcyon Long', smg: 'Marrow-9', shotgun: 'Breakline-3', sniper: 'Sigil Far', fusion: 'Tolland Arc', linear: 'Lancet-5', rocket: 'Tolland-2', mg: 'Breaker-6', glauncher: 'Harrow Drum' };

/** One common weapon of every archetype the player doesn't already own. */
export function armoryGear(owned, power) {
  return Object.values(ARCHETYPES)
    .filter((A) => !owned.has(A.id))
    .map((A) => ({ ...makeWeapon(A.slot, power, 0, A.id), name: ARMORY_NAMES[A.id] ?? A.name }));
}

export function dismantleValue(it) {
  return [5, 12, 30, 70, 160][RARITIES.findIndex((r) => r.id === it.rarity)] + it.power;
}
