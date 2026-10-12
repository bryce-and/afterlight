// ---------- Elements & rarity ----------
export const ELEMENTS = {
  kinetic: { id: 'kinetic', name: 'Kinetic', color: '#dfe6ee', hex: 0xdfe6ee },
  solar: { id: 'solar', name: 'Solar', color: '#ff8b2b', hex: 0xff8b2b },
  arc: { id: 'arc', name: 'Arc', color: '#5fd3ff', hex: 0x5fd3ff },
  void: { id: 'void', name: 'Void', color: '#b07cff', hex: 0xb07cff },
};
export const ENERGY = ['solar', 'arc', 'void'];

export const RARITIES = [
  { id: 'common', name: 'Common', color: '#c9ced4', hex: 0xc9ced4, perks: 0, mult: 1.0, armorPts: 6 },
  { id: 'uncommon', name: 'Uncommon', color: '#45b764', hex: 0x45b764, perks: 1, mult: 1.04, armorPts: 8 },
  { id: 'rare', name: 'Rare', color: '#4d8fe0', hex: 0x4d8fe0, perks: 2, mult: 1.08, armorPts: 10 },
  { id: 'legendary', name: 'Legendary', color: '#a066ea', hex: 0xa066ea, perks: 3, mult: 1.13, armorPts: 13 },
  { id: 'exotic', name: 'Exotic', color: '#f4c542', hex: 0xf4c542, perks: 2, mult: 1.2, armorPts: 17 },
];
export const RARITY_WEIGHTS = [44, 30, 17, 7.5, 1.5];
export const rarityIndex = (id) => RARITIES.findIndex((r) => r.id === id);

// ---------- Slots ----------
export const WEAPON_SLOTS = ['primary', 'special', 'heavy'];
export const ARMOR_SLOTS = ['helmet', 'arms', 'chest', 'legs'];
export const SLOTS = [...WEAPON_SLOTS, ...ARMOR_SLOTS];
export const SLOT_NAMES = {
  primary: 'Primary', special: 'Special', heavy: 'Heavy',
  helmet: 'Helmet', arms: 'Gauntlets', chest: 'Chest Armor', legs: 'Leg Armor',
};

// ---------- Weapon archetypes ----------
export const ARCHETYPES = {
  auto: { id: 'auto', name: 'Auto Rifle', slot: 'primary', dmg: 15, rpm: 600, mode: 'auto', mag: 34, reload: 1.9, spread: 0.028, ads: 0.007, zoom: 1.35, prec: 1.6, range: 38, recoil: 0.010, bloom: 0.003 },
  hand: { id: 'hand', name: 'Hand Cannon', slot: 'primary', dmg: 60, rpm: 140, mode: 'semi', mag: 11, reload: 1.7, spread: 0.014, ads: 0.002, zoom: 1.45, prec: 2.0, range: 32, recoil: 0.045 },
  pulse: { id: 'pulse', name: 'Pulse Rifle', slot: 'primary', dmg: 22, rpm: 900, mode: 'burst', burst: 3, burstDelay: 0.3, mag: 30, reload: 2.0, spread: 0.02, ads: 0.004, zoom: 1.5, prec: 1.7, range: 42, recoil: 0.012 },
  scout: { id: 'scout', name: 'Scout Rifle', slot: 'primary', dmg: 40, rpm: 200, mode: 'semi', mag: 16, reload: 2.1, spread: 0.02, ads: 0.001, zoom: 2.2, prec: 1.8, range: 60, recoil: 0.02 },
  smg: { id: 'smg', name: 'Submachine Gun', slot: 'primary', dmg: 10, rpm: 900, mode: 'auto', mag: 42, reload: 1.6, spread: 0.04, ads: 0.016, zoom: 1.2, prec: 1.5, range: 20, recoil: 0.006, bloom: 0.002 },
  shotgun: { id: 'shotgun', name: 'Shotgun', slot: 'special', dmg: 16, pellets: 10, rpm: 70, mode: 'semi', mag: 5, reserve: 20, brick: 4, reload: 2.2, spread: 0.075, ads: 0.06, zoom: 1.15, prec: 1.4, range: 12, recoil: 0.08 },
  sniper: { id: 'sniper', name: 'Sniper Rifle', slot: 'special', dmg: 260, rpm: 50, mode: 'semi', mag: 4, reserve: 16, brick: 4, reload: 2.5, spread: 0.07, ads: 0.0, zoom: 4.5, prec: 2.6, range: 150, recoil: 0.09 },
  fusion: { id: 'fusion', name: 'Fusion Rifle', slot: 'special', dmg: 38, pellets: 7, charge: 0.6, rpm: 70, mode: 'charge', mag: 5, reserve: 20, brick: 5, reload: 2.3, spread: 0.035, ads: 0.022, zoom: 1.3, prec: 1.3, range: 28, recoil: 0.06 },
  linear: { id: 'linear', name: 'Linear Fusion Rifle', slot: 'heavy', dmg: 430, charge: 0.55, rpm: 70, mode: 'charge', mag: 6, reserve: 18, brick: 4, reload: 2.6, spread: 0.045, ads: 0.0, zoom: 2.6, prec: 2.4, range: 120, recoil: 0.07, pierce: true },
  rocket: { id: 'rocket', name: 'Rocket Launcher', slot: 'heavy', dmg: 560, rpm: 40, mode: 'semi', mag: 1, reserve: 6, brick: 2, reload: 2.4, spread: 0.004, ads: 0.0, zoom: 1.4, prec: 1, range: 200, recoil: 0.08, projectile: { speed: 42, gravity: 0, radius: 6.5, size: 0.18 } },
  mg: { id: 'mg', name: 'Machine Gun', slot: 'heavy', dmg: 26, rpm: 720, mode: 'auto', mag: 70, reserve: 210, brick: 60, reload: 3.0, spread: 0.032, ads: 0.012, zoom: 1.35, prec: 1.5, range: 45, recoil: 0.012, bloom: 0.002 },
  glauncher: { id: 'glauncher', name: 'Grenade Launcher', slot: 'heavy', dmg: 260, rpm: 110, mode: 'semi', mag: 4, reserve: 12, brick: 4, reload: 2.6, spread: 0.01, ads: 0.004, zoom: 1.3, prec: 1, range: 120, recoil: 0.05, projectile: { speed: 32, gravity: 16, radius: 4.5, size: 0.12 } },
};

// ---------- Perks ----------
export const PERKS = {
  rampage: { name: 'Rampage', desc: 'Kills grant stacking +12% damage (x3) for 5s.' },
  killclip: { name: 'Kill Clip', desc: 'Reloading within 3s of a kill grants +30% damage for 5s.' },
  outlaw: { name: 'Outlaw', desc: 'Precision kills greatly increase reload speed for 6s.' },
  extmag: { name: 'Extended Mag', desc: '+30% magazine size.' },
  firefly: { name: 'Firefly', desc: 'Precision kills cause a solar explosion.' },
  leech: { name: 'Life Leech', desc: 'Kills restore 20 health.' },
  steady: { name: 'Steady Hands', desc: '35% less spread and recoil.' },
  hotswap: { name: 'Hot Swap', desc: 'Much faster weapon swap and 15% faster reload.' },
  highcal: { name: 'High-Caliber Rounds', desc: '+10% damage.' },
  precise: { name: 'Precision Frame', desc: '+20% precision damage.' },
  scavenger: { name: 'Scavenger', desc: 'Kills have a chance to refill reserve ammo.' },
  overflow: { name: 'Overflow', desc: 'Ammo pickups overfill the magazine to 2x.' },
};
export const EXOTIC_PERKS = {
  chain: { name: 'Chain Lightning', desc: 'Every hit arcs to a nearby enemy for 50% damage.' },
  endless: { name: 'Bottomless', desc: 'Every 3rd hit returns a round to the magazine.' },
  tracking: { name: 'Seeker Payload', desc: 'Rockets track the nearest enemy.' },
  cluster: { name: 'Cluster Bombs', desc: 'Explosions scatter 4 secondary blasts.' },
  voidheart: { name: 'Voidheart', desc: 'Every kill detonates the target in a void explosion.' },
  pierce: { name: 'Overpenetration', desc: 'Shots pierce through every enemy in their path.' },
  sunburst: { name: 'Sunburst', desc: 'Every 4th precision hit detonates in solar fire.' },
};
export const PERK_POOL = {
  primary: ['rampage', 'killclip', 'outlaw', 'extmag', 'firefly', 'leech', 'steady', 'hotswap', 'highcal', 'precise'],
  special: ['rampage', 'killclip', 'outlaw', 'extmag', 'firefly', 'leech', 'steady', 'hotswap', 'highcal', 'scavenger', 'overflow'],
  heavy: ['rampage', 'killclip', 'extmag', 'leech', 'steady', 'hotswap', 'highcal', 'scavenger', 'overflow'],
};
export const EXOTIC_WEAPONS = [
  { name: 'Ever Hungry', arch: 'auto', element: 'kinetic', perk: 'endless', flavor: '"It has never once been full."' },
  { name: 'Hollow Sun', arch: 'hand', element: 'solar', perk: 'sunburst', flavor: '"Six chambers. One star."' },
  { name: 'Ozone Saint', arch: 'pulse', element: 'arc', perk: 'chain', flavor: '"Pray to the storm. It listens."' },
  { name: 'Ninth Lantern', arch: 'scout', element: 'void', perk: 'voidheart', flavor: '"Eight went out. This one stayed lit."' },
  { name: 'Quiet Verdict', arch: 'sniper', element: 'void', perk: 'pierce', flavor: '"The sentence is passed before the sound arrives."' },
  { name: 'Tempest Choir', arch: 'mg', element: 'arc', perk: 'chain', flavor: '"Every round a voice. Every voice a thunderclap."' },
  { name: 'Dawnspear', arch: 'linear', element: 'void', perk: 'voidheart', flavor: '"One line drawn through the dark."' },
  { name: "Seeker's Wrath", arch: 'rocket', element: 'solar', perk: 'tracking', flavor: '"It knows where you hid."' },
  { name: 'Tenfold Psalm', arch: 'glauncher', element: 'arc', perk: 'cluster', flavor: '"One verse becomes ten."' },
];
export const EXOTIC_ARMOR = {
  helmet: 'Crown of the Wanderer', arms: 'Hands of Ruin', chest: 'Heart of the Pyre', legs: 'Stride of the Comet',
};

// ---------- Classes ----------
export const CLASSES = {
  vanguard: {
    id: 'vanguard', name: 'Vanguard', element: 'solar', color: '#ff8b2b',
    tagline: 'Unbreakable frontline. Walls, fists, and fire.',
    base: { mob: 2, res: 7, rec: 3 }, jump: 'lift', jumpName: 'Lift (hold Space in air)',
    abilities: {
      grenade: { id: 'pulse', name: 'Thermite Pulse', cd: 22, desc: 'Lands and pulses solar fire six times.' },
      melee: { id: 'fist', name: 'Seismic Fist', cd: 10, desc: 'Lunge at a nearby target and detonate on impact.' },
      class: { id: 'barricade', name: 'Barricade', cd: 26, desc: 'Raise a wall that blocks enemy fire and instantly reloads all weapons.' },
      super: { id: 'hammers', name: 'Sunforge Hammers', desc: 'For 15s hurl explosive solar hammers and take 40% less damage.' },
    },
  },
  stalker: {
    id: 'stalker', name: 'Stalker', element: 'arc', color: '#5fd3ff',
    tagline: 'Agile marksman. Dodges, knives, and lightning.',
    base: { mob: 7, res: 2, rec: 3 }, jump: 'double', jumpName: 'Double Jump',
    abilities: {
      grenade: { id: 'arcbolt', name: 'Arcbolt Grenade', cd: 20, desc: 'Detonates and chains lightning to up to 4 nearby enemies.' },
      melee: { id: 'knife', name: 'Throwing Knife', cd: 9, desc: 'Throw a charged knife. Precision hits deal double damage.' },
      class: { id: 'dodge', name: 'Tactical Dodge', cd: 10, desc: 'Dash in your movement direction and instantly reload.' },
      super: { id: 'revolver', name: 'Storm Revolver', desc: 'Six devastating arc shots that chain to nearby enemies.' },
    },
  },
  arcanist: {
    id: 'arcanist', name: 'Arcanist', element: 'void', color: '#b07cff',
    tagline: 'Space-magic scholar. Heal, siphon, and annihilate.',
    base: { mob: 3, res: 3, rec: 7 }, jump: 'glide', jumpName: 'Glide (hold Space in air)',
    abilities: {
      grenade: { id: 'vortex', name: 'Vortex Grenade', cd: 24, desc: 'Creates a void singularity that pulls and shreds enemies.' },
      melee: { id: 'siphon', name: 'Siphon Palm', cd: 11, desc: 'Ranged void strike that restores health and shields.' },
      class: { id: 'rift', name: 'Healing Rift', cd: 32, desc: 'Conjure a well that heals you and speeds reloads while inside.' },
      super: { id: 'nova', name: 'Nova Bomb', desc: 'Hurl a massive ball of void energy that erases everything it hits.' },
    },
  },
};

// ---------- Enemies ----------
export const ENEMY_TYPES = {
  grunt: { hp: 95, speed: 3.4, range: 26, prefer: 14, fireCd: [1.4, 2.4], burst: 3, burstGap: 0.14, dmg: 6, projSpeed: 26, shotSize: 0.11, scale: 1.0 },
  rusher: { hp: 70, speed: 7.2, melee: true, meleeDmg: 16, scale: 0.9 },
  captain: { hp: 300, shield: 180, speed: 3.8, range: 30, prefer: 16, fireCd: [1.2, 2.0], burst: 5, burstGap: 0.1, dmg: 7, projSpeed: 30, shotSize: 0.12, scale: 1.2 },
  heavy: { hp: 900, speed: 2.3, range: 34, prefer: 13, fireCd: [2.2, 3.2], burst: 1, burstGap: 0.2, dmg: 26, projSpeed: 17, shotSize: 0.3, splash: 3, scale: 1.65 },
  boss: { hp: 5200, shield: 1500, speed: 2.6, range: 45, prefer: 16, fireCd: [1.6, 2.4], burst: 5, burstGap: 0.12, dmg: 12, projSpeed: 24, shotSize: 0.22, splash: 2.5, scale: 2.6 },
};

// ---------- Locations ----------
export const LOCATIONS = [
  {
    id: 'earth', name: 'The Rustfields', planetName: 'Earth', faction: 'Scrappers',
    desc: 'Rust-choked ruins of an old launch yard. Scrapper crews strip the bones of the dead colony ships, and they do not like visitors.',
    fog: [40, 190], sunDir: [0.6, 1, 0.35], light: { hemi: 1.6, sun: 2.4 },
    colors: { sky: 0xe7b585, fog: 0xdcaa7c, hemiTop: 0xffe3bd, hemiBot: 0x5e4a36, sun: 0xfff1d8, ground: 0x9c7d57, ground2: 0x8a6c47, rock: 0x7f6f5f, rock2: 0x675a4c, wall: 0x8c8378, metal: 0x6d7279, accent: 0xb0562c, crate: 0x7a8a5a, foliage: 0x3f5a3a, enemy: 0x46627f, enemy2: 0x262f3a, eye: 0x7fd8ff },
    planetColors: { sea: true, c: [0x2b5d8f, 0x3f7d4a, 0x8a7350, 0xe2e2e2] }, atmo: 0x6fb2ff,
    skyBody: { color: 0xeaeef2, size: 38, pos: [-260, 150, -420] },
    enemyNames: { grunt: 'Scrapper', rusher: 'Skitter', captain: 'Scrap Captain', heavy: 'Hulk' },
    zoneNames: ['Rust Gate', 'The Ferry Yards', 'Signal Hill', 'Sunken Depot', 'Kiln Crater', 'Breaker Row'],
    missions: [
      { id: 'e1', name: 'A Rusted Dawn', power: 10, zones: 3, boss: { name: 'Kesh, Scrap-Baron', element: 'arc' }, desc: 'Scrappers have overrun the old ferry yards. Push through and take out their baron.' },
      { id: 'e2', name: 'Signal in the Static', power: 18, zones: 3, boss: { name: 'Vorn the Unbent', element: 'solar' }, desc: 'A distress beacon pulses from Signal Hill. Something big is sitting on it.' },
      { id: 'e3', name: 'The Iron Choir', power: 26, zones: 4, boss: { name: 'Archon Skarr', element: 'void' }, desc: 'The Scrapper Archon is rallying every crew in the Rustfields. Silence the choir.' },
    ],
  },
  {
    id: 'moon', name: 'Selene Hollow', planetName: 'Moon', faction: 'The Hollow',
    desc: 'Beneath the grey dust, something ancient has been eating its way to the surface. The Hollow worship it. They feed it.',
    fog: [30, 165], sunDir: [-0.4, 1, 0.5], light: { hemi: 1.7, sun: 2.0 },
    colors: { sky: 0x0b0e16, fog: 0x161c29, hemiTop: 0xaab6cc, hemiBot: 0x2a2e36, sun: 0xd8e4ff, ground: 0x9da2a8, ground2: 0x8a8f95, rock: 0x6c7177, rock2: 0x575c62, wall: 0x7d7f86, metal: 0x50555d, accent: 0x58ff9c, crate: 0x5c6a62, foliage: 0x3b4a44, enemy: 0xd6cfb8, enemy2: 0x3a382f, eye: 0x6dff8e },
    planetColors: { sea: false, c: [0x5d6268, 0x7d8288, 0x9ea3a8, 0xc8ccd0] }, atmo: 0x9fb4d0,
    skyBody: { color: 0x4d8fd8, size: 60, pos: [200, 120, -400] },
    enemyNames: { grunt: 'Acolyte', rusher: 'Crawler', captain: 'Wraith Knight', heavy: 'Gorger' },
    zoneNames: ['Pale Basin', 'Tithe Ridge', 'The Bone Garden', 'Silent Expanse', 'Hollow Spire', 'Lantern Trench'],
    missions: [
      { id: 'm1', name: 'Pale Descent', power: 35, zones: 3, boss: { name: 'Ossuar the Gorged', element: 'void' }, desc: 'Descend into the basin where the Hollow first broke the surface.' },
      { id: 'm2', name: 'Tithe of Bone', power: 44, zones: 4, boss: { name: 'Vael, Wraith Queen', element: 'arc' }, desc: 'The Hollow are collecting a tithe. Interrupt the harvest before it is paid.' },
      { id: 'm3', name: 'Heart of the Hollow', power: 53, zones: 4, boss: { name: 'The Hollow Mother', element: 'solar' }, desc: 'Their brood mother stirs. Kill her before the next generation hatches.' },
    ],
  },
  {
    id: 'mars', name: 'Ochre Expanse', planetName: 'Mars', faction: 'The Legion',
    desc: 'A war-machine empire has dug into the red dunes. Their fortresses are bigger, their soldiers are bigger, and their guns are much bigger.',
    fog: [40, 190], sunDir: [0.3, 1, -0.4], light: { hemi: 1.5, sun: 2.5 },
    colors: { sky: 0xe39a6b, fog: 0xd98c5e, hemiTop: 0xffd2b0, hemiBot: 0x5c2c1c, sun: 0xfff0da, ground: 0xc0633b, ground2: 0xa9542f, rock: 0x8a3f25, rock2: 0x70321f, wall: 0x9a7d6a, metal: 0x5c5651, accent: 0xffcb47, crate: 0x6e5e4a, foliage: 0x5b3a2a, enemy: 0x8b2c24, enemy2: 0x3a2420, eye: 0xffb347 },
    planetColors: { sea: false, c: [0x7a3420, 0xb3552f, 0xd07a45, 0xe8c4a0] }, atmo: 0xff9a6a,
    skyBody: { color: 0xbfa898, size: 18, pos: [-200, 170, -380] },
    enemyNames: { grunt: 'Trooper', rusher: 'War Hound', captain: 'Praetor', heavy: 'Juggernaut' },
    zoneNames: ['Red Scar', 'Glass Dunes', 'Iron Bastion', 'Vermilion Gate', 'Dustwell', 'The Furnace'],
    missions: [
      { id: 'r1', name: 'Dust and Iron', power: 62, zones: 4, boss: { name: 'Praetor Dhaul', element: 'solar' }, desc: 'Break the Legion forward line in the Red Scar.' },
      { id: 'r2', name: 'The Red Bastion', power: 72, zones: 4, boss: { name: 'Warlord Ixx', element: 'void' }, desc: 'Storm the bastion and bring down the warlord who holds it.' },
      { id: 'r3', name: 'Fall of the Juggernaut', power: 82, zones: 5, boss: { name: 'Juggernaut Prime Maxim', element: 'arc' }, desc: 'The Legion\'s mightiest walker awakens. End it, and end their hold on Mars.' },
    ],
  },
];

export const CONTROLS = [
  ['WASD', 'Move'], ['Shift', 'Sprint'], ['Space', 'Jump / class jump'], ['Mouse', 'Look'],
  ['LMB', 'Fire'], ['RMB', 'Aim down sights'], ['R', 'Reload'], ['1 2 3 / Wheel', 'Switch weapon'],
  ['Q', 'Grenade'], ['F', 'Melee'], ['C', 'Class ability'], ['X', 'Super'], ['E', 'Interact'], ['Esc', 'Pause'],
];
