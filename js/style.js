// Fashion Is Endgame (v1.6): armor looks, destination sets, set bonuses and shaders.
// Pure data and rules (no DOM, no Three.js) so tools/tests.html can check them directly.
// characters.js turns a look into meshes; icons.js renders a piece from it.
import { hashStr } from './util.js';

export const SET_PIECES = 3; // pieces of one set needed for its bonus (any 3 of the 4)

// ---------- looks ----------
// A look is a palette (null = the class's own colors) plus a variant per armor slot. characters.js
// builds the class silhouette (Titan plates, Hunter cloak, Warlock coat) and adds these on top.
//   helmet.visor: slit | T | eyes | wide | round     helmet.crest: null | fin | horns | antenna | crown | spikes | halo
//   arms.cuff: plain | layered | spiked | bracer      arms.light: glowing strip on the forearm
//   chest.plate: flat | ridge | layered | vents | emblem    chest.shoulder: small | big | tall
//   legs.knee: plain | pad | spike | guard            legs.shin: plain | plated | stripe
const look = (colors, helmet, arms, chest, legs, extra = {}) => ({ colors, helmet, arms, chest, legs, ...extra });
const C = (armor, trim, under, cloth) => ({ armor, trim, under, cloth });

export const LOOKS = {
  // rolled armor below legendary: the class's own colors, plainer shapes by rarity
  g0: look(null, { visor: 'slit', crest: null }, { cuff: 'plain' }, { plate: 'flat', shoulder: 'small' }, { knee: 'plain', shin: 'plain' }),
  g1: look(null, { visor: 'T', crest: null }, { cuff: 'plain' }, { plate: 'ridge', shoulder: 'small' }, { knee: 'pad', shin: 'plain' }),
  g2: look(null, { visor: 'T', crest: 'fin' }, { cuff: 'layered' }, { plate: 'layered', shoulder: 'big' }, { knee: 'pad', shin: 'plated' }),
  // every exotic piece: dark plate, gilded trim that glows
  exotic: look(C(0x35313b, 0xf4c542, 0x1c1a20, 0x5a4520), { visor: 'wide', crest: 'crown', jaw: true }, { cuff: 'spiked', light: true }, { plate: 'emblem', shoulder: 'tall' }, { knee: 'guard', shin: 'stripe' }, { glowTrim: true }),
};

// ---------- destination sets (legendary) ----------
// One set per destination; ids match LOCATIONS. Legendary armor from a mission is that destination's set.
const pieces = (n, helmet, arms, chest, legs) => ({ helmet: `${n} ${helmet}`, arms: `${n} ${arms}`, chest: `${n} ${chest}`, legs: `${n} ${legs}` });
export const SETS = {
  earth: {
    name: 'Skywatch', dest: 'The Cosmodrome', pieces: pieces('Skywatch', 'Helm', 'Gauntlets', 'Plate', 'Greaves'),
    bonus: { name: 'Golden Age Salvage', desc: 'Reload 15% faster.' },
    look: look(C(0x7d6a4f, 0xc0612b, 0x34302a, 0x8a4a24), { visor: 'T', crest: 'antenna' }, { cuff: 'bracer' }, { plate: 'vents', shoulder: 'big' }, { knee: 'pad', shin: 'stripe' }),
  },
  moon: {
    name: 'Hellmouth Vigil', dest: 'The Hellmouth', pieces: pieces('Vigil', 'Mask', 'Grips', 'Cuirass', 'Strides'),
    bonus: { name: "Crota's Bane", desc: 'Precision weapon kills restore 20 health.' },
    look: look(C(0xcfc8b4, 0x4e6b3a, 0x22261f, 0x3c4a2c), { visor: 'eyes', crest: 'horns' }, { cuff: 'spiked' }, { plate: 'ridge', shoulder: 'tall' }, { knee: 'spike', shin: 'plated' }),
  },
  mars: {
    name: 'Meridian Legion', dest: 'Meridian Bay', pieces: pieces('Meridian', 'Helm', 'Bracers', 'Harness', 'Treads'),
    bonus: { name: 'Rally the Line', desc: 'Picking up an Orb of Power gives 1 extra armor charge.' },
    look: look(C(0x9a4632, 0xc9a25a, 0x2d2420, 0x6e2a1e), { visor: 'wide', crest: 'fin' }, { cuff: 'layered' }, { plate: 'layered', shoulder: 'big' }, { knee: 'guard', shin: 'plated' }),
  },
  titan: {
    name: 'Arcology', dest: 'New Pacific Arcology', pieces: pieces('Arcology', 'Visor', 'Gloves', 'Vest', 'Boots'),
    bonus: { name: 'Tidewater Seals', desc: 'Your shield starts recharging 25% sooner.' },
    look: look(C(0x4f6f78, 0xd9dde0, 0x1f2a2e, 0x2c5560), { visor: 'round', crest: null, jaw: true }, { cuff: 'plain', light: true }, { plate: 'emblem', shoulder: 'small' }, { knee: 'pad', shin: 'stripe' }),
  },
  tangled: {
    name: 'Reef Outlaw', dest: 'The Tangled Shore', pieces: pieces('Outlaw', 'Hood', 'Wraps', 'Coat', 'Treads'),
    bonus: { name: "Outlaw's Edge", desc: 'Powered melee kills make your weapons deal 15% more damage for 6 seconds.' },
    look: look(C(0x3a3540, 0xb08a3e, 0x1a181d, 0x6b2f5c), { visor: 'slit', crest: 'spikes' }, { cuff: 'bracer', light: true }, { plate: 'ridge', shoulder: 'small' }, { knee: 'spike', shin: 'plain' }),
  },
  io: {
    name: 'Sacred Ground', dest: 'Io', pieces: pieces('Pyramidion', 'Crown', 'Gauntlets', 'Robes', 'Greaves'),
    bonus: { name: "Traveler's Echo", desc: 'Your super charges 10% faster over time.' },
    look: look(C(0xd9b46a, 0xf2ead2, 0x3a2a1c, 0xb8662c), { visor: 'round', crest: 'halo' }, { cuff: 'layered', light: true }, { plate: 'emblem', shoulder: 'tall' }, { knee: 'guard', shin: 'stripe' }),
  },
};
export const SET_IDS = Object.keys(SETS);
for (const id of SET_IDS) LOOKS[id] = SETS[id].look;

/** Set bonus numbers (the Player reads these). */
export const SET_TUNE = { reload: 0.85, precHeal: 20, orbCharge: 1, regenDelay: 0.75, outlawDmg: 1.15, outlawT: 6, superPassive: 1.1 };

/** The look an armor piece shows: its set, the exotic look, or a plain look by rarity. */
export function lookOf(item) {
  if (!item) return 'g0';
  if (item.set && SETS[item.set]) return item.set;
  if (item.rarity === 'exotic') return 'exotic';
  return { common: 'g0', uncommon: 'g1', rare: 'g2' }[item.rarity] || 'g2';
}

/** Which set a new legendary drop belongs to: the destination's own set, otherwise (activities, rewards) a random one. */
export function setForDrop(dest, rnd = Math.random) {
  return SETS[dest] ? dest : SET_IDS[Math.floor(rnd() * SET_IDS.length)];
}

/** A stable set for an existing legendary from before v1.6 (the same item always gets the same set). */
export const setForLegacy = (item) => SET_IDS[hashStr(String(item.id)) % SET_IDS.length];

/** Pieces worn per set (exotics and rolled armor below legendary count toward none). */
export function setCounts(items) {
  const n = {};
  for (const it of items) if (it?.set && SETS[it.set] && it.rarity !== 'exotic') n[it.set] = (n[it.set] || 0) + 1;
  return n;
}
export const activeSets = (items) => Object.entries(setCounts(items)).filter(([, c]) => c >= SET_PIECES).map(([id]) => id);

// ---------- shaders ----------
// A shader recolors every armor piece the Guardian wears (glows keep the subclass color). One per class.
export const SHADERS = {
  superblack: { name: 'Superblack', colors: C(0x1d1e21, 0x3a3c41, 0x0f1012, 0x18191c) },
  monochrome: { name: 'Monochromatic', colors: C(0xe4e6e8, 0xa9adb3, 0x55595f, 0xd2d4d7) },
  calus: { name: "Calus's Preferred", colors: C(0xc9a23f, 0x5a2a7a, 0x2a1a33, 0x6b2c8c) },
  glacier: { name: 'Glacial Bloom', colors: C(0xcfe6f2, 0x5c8fb0, 0x2b3a48, 0x8cbfd9) },
  crimson: { name: 'Crimson Vow', colors: C(0x7a1e22, 0x1c1c1f, 0x2a1416, 0x9c2a2a) },
  vanguard: { name: 'Vanguard Steel', colors: C(0x56606d, 0xe07a2a, 0x262b31, 0x2f4f7a) },
  rust: { name: 'Cosmodrome Rust', colors: C(0xb0703a, 0x4a3a2a, 0x2e241b, 0x8a4a24) },
  reef: { name: 'Reefborn Teal', colors: C(0x2f6f66, 0xb7d6cf, 0x173330, 0x3e8a7d) },
  bone: { name: 'Hive Bone', colors: C(0xd8d0b8, 0x6a8a3a, 0x2a2b22, 0x7a6a4a) },
  nightfall: { name: 'Nightfall Violet', colors: C(0x3d2a5c, 0xb9bccc, 0x1a1428, 0x55307a) },
};
export const SHADER_IDS = Object.keys(SHADERS);
/** Mission caches: chance of a shader you don't own yet. A destination's final mission always gives one on its first clear. */
export const SHADER_DROP = { chance: 0.25 };

/** Rolls a shader drop. Returns an id the player doesn't own, or null (never a duplicate). */
export function rollShader(owned, guaranteed = false, rnd = Math.random) {
  const left = SHADER_IDS.filter((id) => !owned.includes(id));
  if (!left.length || (!guaranteed && rnd() >= SHADER_DROP.chance)) return null;
  return left[Math.floor(rnd() * left.length)];
}

/** The shader a class wears (null = the armor's own colors). An unowned or unknown id reads as none. */
export function shaderFor(shaders, classId) {
  const id = shaders?.applied?.[classId];
  return id && SHADERS[id] && shaders.owned.includes(id) ? id : null;
}

// ---------- appearance ----------
// { helmet, arms, chest, legs: look id, shader: id | null }. Encoded for the network as "a,b,c,d|shader".
export function appearance(items, shader = null) {
  const by = Object.fromEntries(items.filter(Boolean).map((it) => [it.slot, it]));
  return { helmet: lookOf(by.helmet), arms: lookOf(by.arms), chest: lookOf(by.chest), legs: lookOf(by.legs), shader: SHADERS[shader] ? shader : null };
}
export const encodeAppearance = (a) => `${a.helmet},${a.arms},${a.chest},${a.legs}|${a.shader || ''}`;
export function decodeAppearance(str) {
  const [looks = '', sh = ''] = String(str || '').split('|');
  const [helmet, arms, chest, legs] = looks.split(',').map((l) => (LOOKS[l] ? l : 'g0'));
  return { helmet: helmet || 'g0', arms: arms || 'g0', chest: chest || 'g0', legs: legs || 'g0', shader: SHADERS[sh] ? sh : null };
}
