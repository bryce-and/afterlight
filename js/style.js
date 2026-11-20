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
//   classitem.form: 0 | 1 | 2 (U27): the silhouette variant of the cloak, mark or bond; characters.js maps it per class
const look = (colors, helmet, arms, chest, legs, extra = {}) => ({ colors, helmet, arms, chest, legs, classitem: { form: 0 }, ...extra });
const C = (armor, trim, under, cloth) => ({ armor, trim, under, cloth });

export const LOOKS = {
  // rolled armor below legendary: the class's own colors, plainer shapes by rarity
  g0: look(null, { visor: 'slit', crest: null }, { cuff: 'plain' }, { plate: 'flat', shoulder: 'small' }, { knee: 'plain', shin: 'plain' }),
  g1: look(null, { visor: 'T', crest: null }, { cuff: 'plain' }, { plate: 'ridge', shoulder: 'small' }, { knee: 'pad', shin: 'plain' }),
  g2: look(null, { visor: 'T', crest: 'fin' }, { cuff: 'layered' }, { plate: 'layered', shoulder: 'big' }, { knee: 'pad', shin: 'plated' }),
  // every exotic piece: dark plate, gilded trim that glows
  exotic: look(C(0x35313b, 0xf4c542, 0x1c1a20, 0x5a4520), { visor: 'wide', crest: 'crown', jaw: true }, { cuff: 'spiked', light: true }, { plate: 'emblem', shoulder: 'tall' }, { knee: 'guard', shin: 'stripe' }, { glowTrim: true }),
};

// H32: every exotic armor piece (and exotic class item) has its own look: its own palette and its own shapes. Keyed by item name; lookOf() returns `ex_<slug>`.
const EXOTIC_ROWS = [
  ["An Insurmountable Skullfort", 0x8a8f98, 0xc9c2a8, 0x2a2c30, 0x6a1a1a, "slit", "horns", 1, "layered", 0, "ridge", "big", "spike", "plated", 0],
  ["Mask of the Quiet One", 0x2c3a4a, 0x7fd0ff, 0x151c24, 0x20405a, "eyes", null, 0, "plain", 1, "flat", "small", "plain", "stripe", 0],
  ["Synthoceps", 0x59626e, 0xff8a2a, 0x24282e, 0x7a3a14, "T", "fin", 0, "layered", 1, "layered", "big", "guard", "plated", 0],
  ["Ursa Furiosa", 0x6b5a44, 0xe8e0c8, 0x2e261c, 0x8a6a3a, "wide", "spikes", 1, "bracer", 0, "ridge", "tall", "pad", "plain", 0],
  ["Heart of Inmost Light", 0x3a2f55, 0xb89cff, 0x1a1428, 0x4a2a7a, "round", "crown", 1, "layered", 1, "emblem", "big", "guard", "stripe", 1],
  ["Hallowfire Heart", 0x7a2a1a, 0xffc04a, 0x2a120c, 0xb34a1a, "wide", "halo", 1, "spiked", 1, "emblem", "tall", "spike", "plated", 1],
  ["Hoarfrost-Z", 0xb7d6ea, 0x5ac8ff, 0x2a3a48, 0x9ac0dc, "T", "fin", 0, "layered", 1, "vents", "big", "pad", "stripe", 1],
  ["Dunemarchers", 0xb59a5e, 0x4a3a1e, 0x3a2f1c, 0x8a7440, "slit", "antenna", 0, "bracer", 0, "ridge", "small", "spike", "plated", 0],
  ["Loreley Splendor Helm", 0xd8c890, 0xffd870, 0x3a3220, 0x8a7438, "round", "halo", 1, "layered", 1, "emblem", "big", "guard", "plated", 1],
  ["Precious Scars", 0x7a4a3a, 0xe8c8a0, 0x2a1a14, 0x5a3424, "slit", "spikes", 0, "bracer", 0, "ridge", "big", "pad", "plain", 0],
  ["Doom Fang Pauldron", 0x2e3a5a, 0x5fd3ff, 0x141a2a, 0x24305a, "wide", "fin", 0, "spiked", 1, "layered", "tall", "spike", "plated", 1],
  ["Actium War Rig", 0x58606a, 0xffa43a, 0x20242a, 0x3a3f46, "T", null, 0, "bracer", 0, "vents", "big", "guard", "stripe", 0],
  ["Path of Burning Steps", 0x5a2a1a, 0xff7a2a, 0x24120c, 0x8a3a18, "slit", "antenna", 0, "plain", 1, "ridge", "small", "spike", "plated", 1],
  ["Mask of Bakris", 0x2a2a34, 0x9aa4ff, 0x14141c, 0x20203a, "eyes", "horns", 1, "plain", 0, "flat", "small", "plain", "stripe", 1],
  ["Assassin's Cowl", 0x3a1a2a, 0xff5a7a, 0x180c12, 0x4a1a30, "slit", "fin", 0, "spiked", 0, "ridge", "small", "plain", "plain", 0],
  ["Mechaneer's Tricksleeves", 0x6a5a3a, 0xf0d070, 0x2a2214, 0x4a3c1e, "T", null, 0, "bracer", 1, "flat", "small", "pad", "stripe", 0],
  ["Gyrfalcon's Hauberk", 0x3a4a58, 0x8ad0ff, 0x161e26, 0x2a3a4a, "round", "crown", 0, "layered", 1, "layered", "big", "pad", "plated", 1],
  ["Dragon's Shadow", 0x3a2a4a, 0xc89aff, 0x181224, 0x2e1e44, "wide", null, 0, "plain", 0, "flat", "small", "plain", "stripe", 0],
  ["Verity's Brow", 0xd0d4dc, 0x70e0c0, 0x2a2e34, 0x6a7078, "wide", "crown", 1, "plain", 1, "emblem", "small", "plain", "plain", 1],
  ["Crown of Tempests", 0x2a3a5a, 0x7fd8ff, 0x121a2a, 0x24407a, "eyes", "spikes", 1, "layered", 1, "vents", "small", "plain", "stripe", 1],
  ["Phoenix Cradle", 0x6a2a1a, 0xffb040, 0x2a1210, 0x9a3a1a, "T", "halo", 1, "spiked", 1, "emblem", "tall", "spike", "plated", 1],
  ["Karnstein Armlets", 0x4a1a2a, 0xd8404a, 0x200c12, 0x6a1a2a, "slit", "horns", 0, "bracer", 0, "ridge", "big", "pad", "plain", 0],
  ["Vesper of Radius", 0xe0d8c0, 0xffd27a, 0x3a3426, 0x8a7a4a, "round", "halo", 1, "layered", 1, "emblem", "tall", "guard", "plated", 1],
  ["Peacekeepers", 0x4a4f55, 0xd8d8d8, 0x1e2024, 0x303338, "wide", null, 0, "plain", 0, "flat", "small", "guard", "stripe", 0],
  ["Abeyant Leap", 0x2a4a3a, 0x7dffb0, 0x14241c, 0x1c3a2c, "eyes", "fin", 1, "bracer", 1, "vents", "big", "pad", "plain", 1],
  ["Celestial Nighthawk", 0xd2b25a, 0xfff0b0, 0x3a301a, 0x6a4a14, "round", "horns", 1, "bracer", 1, "emblem", "small", "pad", "stripe", 1],
  ["Graviton Forfeit", 0x3a2a55, 0xff7ae0, 0x181024, 0x2a1a44, "wide", "antenna", 1, "plain", 1, "vents", "small", "plain", "plated", 1],
  ["Cyrtarachne's Facade", 0x1c1a22, 0x9a5cff, 0xe0c12, 0x2a1a3a, "eyes", "spikes", 1, "spiked", 0, "layered", "small", "spike", "stripe", 0],
  ["Liar's Handshake", 0x5a3a2a, 0xe0b060, 0x24180f, 0x7a4a24, "T", null, 0, "layered", 0, "flat", "small", "plain", "plain", 0],
  ["Young Ahamkara's Spine", 0x6a1e2a, 0xff9a4a, 0x240c10, 0x8a2a30, "slit", "horns", 1, "spiked", 1, "ridge", "tall", "spike", "plated", 0],
  ["Renewal Grasps", 0x3a6a48, 0xb8ff8a, 0x182a1e, 0x2a5a38, "round", "fin", 0, "layered", 1, "layered", "small", "pad", "stripe", 0],
  ["Raiden Flux", 0x2a3f6a, 0x5ad8ff, 0x121c30, 0x1a2a5a, "wide", "antenna", 1, "bracer", 1, "vents", "small", "plain", "stripe", 1],
  ["Lucky Raspberry", 0x8a2a5a, 0xffd0e8, 0x2a1020, 0xa03a6a, "T", "crown", 0, "plain", 1, "emblem", "small", "pad", "plain", 0],
  ["St0mp-EE5", 0x8a6a2a, 0x3a3a3a, 0x2a2410, 0xb08a3a, "slit", null, 0, "layered", 0, "ridge", "big", "guard", "plated", 1],
  ["Orpheus Rig", 0x4a2a6a, 0xffe08a, 0x1c1228, 0x3a1a5a, "eyes", "halo", 1, "bracer", 1, "flat", "small", "plain", "stripe", 1],
  ["Nezarec's Sin", 0xe0e14, 0xc084ff, 0x8080c, 0x1a0a2a, "wide", "horns", 1, "layered", 1, "emblem", "tall", "guard", "plated", 1],
  ["Skull of Dire Ahamkara", 0xcfc6b0, 0xff6a2a, 0x2a241c, 0x7a2a14, "round", "spikes", 0, "spiked", 0, "ridge", "big", "spike", "plated", 0],
  ["Contraverse Hold", 0x3a5a6a, 0x7affd8, 0x16262e, 0x244a5a, "T", "fin", 1, "bracer", 1, "vents", "small", "pad", "stripe", 1],
  ["Sunbracers", 0xd2a23a, 0xff5a1a, 0x3a2a10, 0xb2501a, "slit", null, 0, "spiked", 1, "flat", "small", "plain", "plain", 1],
  ["Osmiomancy Gloves", 0x3a3a5a, 0xd8e0ff, 0x1a1a2c, 0x2a2a50, "eyes", "antenna", 0, "layered", 0, "layered", "small", "plain", "plated", 0],
  ["Starfire Protocol", 0xe0e4ee, 0xffb02a, 0x303642, 0x6a5a8a, "wide", "crown", 1, "bracer", 1, "emblem", "big", "pad", "stripe", 1],
  ["Stormdancer's Brace", 0x2a5a8a, 0xf0f08a, 0x122238, 0x1a4a7a, "T", "spikes", 1, "spiked", 1, "ridge", "tall", "spike", "stripe", 1],
  ["Transversive Steps", 0x5a3a7a, 0x8affc0, 0x20143a, 0x4a2a6a, "slit", "halo", 0, "plain", 0, "flat", "small", "pad", "plated", 1],
  ["Lunafaction Boots", 0x9aa4b8, 0xe8f0ff, 0x2c3240, 0x5a6a8a, "round", "horns", 0, "layered", 0, "vents", "big", "guard", "plain", 0],
  ["Swarmers", 0x2a3a1a, 0xb8ff3a, 0x141c0c, 0x3a5a1a, "eyes", "spikes", 1, "spiked", 0, "ridge", "small", "spike", "stripe", 1],
  ["Essentialism", 0x5a4a6a, 0xf8e0a0, 0x22202c, 0x6a4a8a, "round", "fin", 1, "layered", 1, "emblem", "big", "pad", "stripe", 1],
  ["Stoicism", 0x6a5a3a, 0xffe060, 0x28221a, 0x8a6a2a, "wide", "crown", 1, "bracer", 1, "layered", "tall", "guard", "plated", 1],
  ["Solipsism", 0x2a2a4a, 0xa8c8ff, 0x14142a, 0x242a5a, "eyes", "halo", 1, "plain", 1, "flat", "small", "plain", "stripe", 1],
];
export const exoticLookId = (name) => `ex_${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '')}`;
for (const [name, armor, trim, under, cloth, visor, crest, jaw, cuff, light, plate, shoulder, knee, shin, glow] of EXOTIC_ROWS) {
  LOOKS[exoticLookId(name)] = look(C(armor, trim, under, cloth), { visor, crest, jaw: !!jaw }, { cuff, light: !!light }, { plate, shoulder }, { knee, shin }, { glowTrim: true, classitem: { form: glow ? 2 : 1 } });
}

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
    bonus: { name: "Crota's Bane", desc: 'Precision weapon kills restore 20% of your health.' },
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
  dc: {
    name: 'Dreaming Court', dest: 'The Dreaming City', pieces: pieces('Court', 'Veil', 'Wraps', 'Mantle', 'Slippers'),
    bonus: { name: "Queen's Grace", desc: 'Your class ability recharges 15% faster.' },
    look: look(C(0xe8e0d0, 0x7fd8ff, 0x3a3250, 0xb48ae0), { visor: 'eyes', crest: 'halo' }, { cuff: 'plain', light: true }, { plate: 'emblem', shoulder: 'tall' }, { knee: 'plain', shin: 'stripe' }),
  },
  leviathan: {
    name: "Emperor's Feast", dest: 'The Leviathan', pieces: pieces('Feast', 'Crown', 'Gauntlets', 'Cuirass', 'Greaves'),
    bonus: { name: "Calus's Indulgence", desc: 'Your powered melee recharges 15% faster.' },
    look: look(C(0x2a2030, 0xffc247, 0x14101a, 0x8a1e2e), { visor: 'wide', crest: 'crown' }, { cuff: 'layered', light: true }, { plate: 'layered', shoulder: 'big' }, { knee: 'guard', shin: 'plated' }),
  },
};
// U23: the Imperial set drops only in The Emperor's Shadow (js/dungeon-loot.js). Each class wears its own names (classPieces).
SETS.imperial = {
  name: 'Imperial', dest: "The Emperor's Shadow", dungeon: 'shadow', pieces: pieces('Imperial', 'Crown', 'Gauntlets', 'Raiment', 'Greaves'),
  classPieces: {
    vanguard: pieces('Imperial Shadow', 'Helm', 'Gauntlets', 'Plate', 'Greaves'),
    stalker: pieces('Imperial Envoy', 'Mask', 'Grips', 'Vest', 'Strides'),
    arcanist: pieces('Imperial Vizier', 'Hood', 'Gloves', 'Robes', 'Boots'),
  },
  bonus: { name: 'Imperial Bearing', desc: 'Favor drains 30% slower, and you take 10% less damage while Favored.' },
  look: look(C(0xe9e2d2, 0xd9a520, 0x1c1424, 0x6a2c9c), { visor: 'wide', crest: 'crown' }, { cuff: 'layered', light: true }, { plate: 'emblem', shoulder: 'tall' }, { knee: 'guard', shin: 'stripe' }),
};
// U25: the Crucible set drops only from a finished Crucible match (js/crucible-loot.js). It has no set bonus: it is worn for the look.
SETS.crucible = {
  name: 'Crucible', dest: 'The Crucible', crucible: true, pieces: pieces('Crucible', 'Helm', 'Gauntlets', 'Plate', 'Greaves'),
  classPieces: {
    vanguard: pieces('Phoenix Strife', 'Helm', 'Gauntlets', 'Plate', 'Greaves'),
    stalker: pieces('Ankaa Seeker', 'Mask', 'Grips', 'Vest', 'Strides'),
    arcanist: pieces('Wing Discipline', 'Hood', 'Gloves', 'Robes', 'Boots'),
  },
  bonus: { name: 'Battle Scars', desc: 'No bonus. This set is worn for its look.' },
  look: look(C(0x585c64, 0xb07a3a, 0x2a2d32, 0xa3222a), { visor: 'wide', crest: 'horns' }, { cuff: 'layered' }, { plate: 'crucible', shoulder: 'big' }, { knee: 'guard', shin: 'plated' }),
};
// U27: each family's class item silhouette (Hunter long / split / tattered cloak, Titan sash / tabard / banner mark, Warlock ring / orbit / band bond)
const CLASSITEM_FORMS = { g0: 0, g1: 0, g2: 1, exotic: 2, earth: 0, moon: 1, mars: 2, titan: 1, tangled: 2, io: 1, dc: 0, leviathan: 2, imperial: 2, crucible: 1 };
export const CLASSITEM_FORM_COUNT = 3;
for (const [id, form] of Object.entries(CLASSITEM_FORMS)) if (LOOKS[id] || SETS[id]) (SETS[id]?.look || LOOKS[id]).classitem = { form };
/** Destination sets: the ones a legendary drop or an old save can be given. Dungeon and Crucible sets are left out. */
export const SET_IDS = Object.keys(SETS).filter((id) => !SETS[id].dungeon && !SETS[id].crucible);
for (const id of Object.keys(SETS)) LOOKS[id] = SETS[id].look;
/** The piece name for a set, slot and class (dungeon sets name each class's pieces). */
export const setPieceName = (set, slot, classId) => {
  if (slot === 'classitem') { // U27: "<set name> <Cloak|Mark|Bond>", from the helmet's name without its last word
    const base = SETS[set].classPieces?.[classId]?.helmet ?? SETS[set].pieces.helmet;
    return `${base.slice(0, base.lastIndexOf(' '))} ${CLASS_ITEM_PIECE[classId] || 'Mark'}`;
  }
  return SETS[set].classPieces?.[classId]?.[slot] ?? SETS[set].pieces[slot];
};
const CLASS_ITEM_PIECE = { vanguard: 'Mark', stalker: 'Cloak', arcanist: 'Bond' };

/** Set bonus numbers (the Player reads these). */
export const SET_TUNE = { reload: 0.85, precHeal: 0.2, orbCharge: 1, regenDelay: 0.75, outlawDmg: 1.15, outlawT: 6, superPassive: 1.1, classCd: 0.85, meleeCd: 0.85 };

/** The look an armor piece shows: its set, the exotic look, or a plain look by rarity. */
export function lookOf(item) {
  if (!item) return 'g0';
  if (item.set && SETS[item.set]) return item.set;
  if (item.rarity === 'exotic') return LOOKS[exoticLookId(item.name)] ? exoticLookId(item.name) : 'exotic';
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
// U23: earned only in The Emperor's Shadow (the first full clear); never a random shader drop
SHADERS.emperorsShadow = { name: "Emperor's Shadow", dungeon: 'shadow', colors: C(0x15101c, 0xd9a520, 0x2a1838, 0x7a3cc0) };
export const SHADER_IDS = Object.keys(SHADERS).filter((id) => !SHADERS[id].dungeon);
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
// { helmet, arms, chest, legs, classitem: look id, shader: id | null }. Encoded for the network as "a,b,c,d,e|shader" (U27 added e; older peers read the first four).
export function appearance(items, shader = null) {
  const by = Object.fromEntries(items.filter(Boolean).map((it) => [it.slot, it]));
  return { helmet: lookOf(by.helmet), arms: lookOf(by.arms), chest: lookOf(by.chest), legs: lookOf(by.legs), classitem: lookOf(by.classitem), shader: SHADERS[shader] ? shader : null };
}
export const encodeAppearance = (a) => `${a.helmet},${a.arms},${a.chest},${a.legs},${a.classitem || 'g0'}|${a.shader || ''}`;
export function decodeAppearance(str) {
  const [looks = '', sh = ''] = String(str || '').split('|');
  const [helmet, arms, chest, legs, classitem] = looks.split(',').map((l) => (LOOKS[l] ? l : 'g0'));
  return { helmet: helmet || 'g0', arms: arms || 'g0', chest: chest || 'g0', legs: legs || 'g0', classitem: classitem || 'g0', shader: SHADERS[sh] ? sh : null };
}
