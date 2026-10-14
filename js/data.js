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
  { id: 'exotic', name: 'Exotic', color: '#f4c542', hex: 0xf4c542, perks: 2, mult: 1.3, armorPts: 17 },
];
export const rarityIndex = (id) => RARITIES.findIndex((r) => r.id === id);

// ---------- Slots ----------
export const WEAPON_SLOTS = ['primary', 'special', 'heavy'];
export const ARMOR_SLOTS = ['helmet', 'arms', 'chest', 'legs'];
export const SLOTS = [...WEAPON_SLOTS, ...ARMOR_SLOTS];
export const AMMO = {
  primary: { name: 'Primary', color: '#f2f4f7', hex: 0xf2f4f7 },
  special: { name: 'Special', color: '#3fd17a', hex: 0x3fd17a },
  heavy: { name: 'Heavy', color: '#a66bff', hex: 0xa66bff },
};
export const SLOT_NAMES = {
  primary: 'Primary', special: 'Special', heavy: 'Heavy',
  helmet: 'Helmet', arms: 'Gauntlets', chest: 'Chest Armor', legs: 'Leg Armor',
};

// ---------- Weapon archetypes ----------
export const ARCHETYPES = {
  auto: { id: 'auto', name: 'Auto Rifle', slot: 'primary', dmg: 15, rpm: 600, mode: 'auto', mag: 34, reload: 1.9, spread: 0.028, ads: 0.0038, zoom: 1.35, prec: 1.6, range: 38, recoil: 0.010, bloom: 0.003 },
  hand: { id: 'hand', name: 'Hand Cannon', slot: 'primary', dmg: 60, rpm: 140, mode: 'semi', mag: 11, reload: 1.7, spread: 0.014, ads: 0.001, zoom: 1.45, prec: 2.0, range: 32, recoil: 0.045 },
  pulse: { id: 'pulse', name: 'Pulse Rifle', slot: 'primary', dmg: 22, rpm: 900, mode: 'burst', burst: 3, burstDelay: 0.3, mag: 30, reload: 2.0, spread: 0.02, ads: 0.0022, zoom: 1.5, prec: 1.7, range: 42, recoil: 0.012 },
  scout: { id: 'scout', name: 'Scout Rifle', slot: 'primary', dmg: 40, rpm: 200, mode: 'semi', mag: 16, reload: 2.1, spread: 0.02, ads: 0.0005, zoom: 1.7, prec: 1.8, range: 60, recoil: 0.02 },
  smg: { id: 'smg', name: 'Submachine Gun', slot: 'primary', dmg: 10, rpm: 900, mode: 'auto', mag: 42, reload: 1.6, spread: 0.04, ads: 0.009, zoom: 1.2, prec: 1.5, range: 20, recoil: 0.006, bloom: 0.002 },
  shotgun: { id: 'shotgun', name: 'Shotgun', slot: 'special', dmg: 23, pellets: 10, rpm: 70, mode: 'semi', mag: 5, reserve: 20, brick: 4, reload: 2.2, spread: 0.075, ads: 0.05, zoom: 1.15, prec: 1.4, range: 12, recoil: 0.08, falloff: { close: 4, bonus: 1.3, min: 0.15, span: 1 } },
  sniper: { id: 'sniper', name: 'Sniper Rifle', slot: 'special', dmg: 360, rpm: 50, mode: 'semi', mag: 4, reserve: 16, brick: 4, reload: 2.5, spread: 0.07, ads: 0.0, zoom: 4.5, prec: 2.6, range: 150, recoil: 0.09 },
  fusion: { id: 'fusion', name: 'Fusion Rifle', slot: 'special', dmg: 52, pellets: 7, charge: 0.6, rpm: 70, mode: 'charge', mag: 5, reserve: 20, brick: 5, reload: 2.3, spread: 0.026, ads: 0.011, falloff: { close: 8, bonus: 1.15, min: 0.3, span: 1 }, zoom: 1.3, prec: 1.3, range: 28, recoil: 0.06 },
  linear: { id: 'linear', name: 'Linear Fusion Rifle', slot: 'heavy', dmg: 430, charge: 0.55, rpm: 70, mode: 'charge', mag: 6, reserve: 18, brick: 4, reload: 2.6, spread: 0.045, ads: 0.0, zoom: 2.6, prec: 2.4, range: 120, recoil: 0.07, pierce: true },
  rocket: { id: 'rocket', name: 'Rocket Launcher', slot: 'heavy', dmg: 900, rpm: 40, mode: 'semi', mag: 1, reserve: 8, brick: 2, reload: 2.4, spread: 0.004, ads: 0.0, zoom: 1.4, prec: 1, range: 200, recoil: 0.08, projectile: { speed: 42, gravity: 0, radius: 6.5, size: 0.18 } },
  mg: { id: 'mg', name: 'Machine Gun', slot: 'heavy', dmg: 32, rpm: 720, mode: 'auto', mag: 70, reserve: 210, brick: 60, reload: 3.0, spread: 0.032, ads: 0.0072, zoom: 1.35, prec: 1.5, range: 45, recoil: 0.012, bloom: 0.002 },
  glauncher: { id: 'glauncher', name: 'Grenade Launcher', slot: 'heavy', dmg: 380, rpm: 110, mode: 'semi', mag: 4, reserve: 16, brick: 4, reload: 2.6, spread: 0.01, ads: 0.0024, zoom: 1.3, prec: 1, range: 120, recoil: 0.05, projectile: { speed: 32, gravity: 16, radius: 4.5, size: 0.12 } },
};

// Damage falloff: full damage out to the weapon's range, then it drops to `min` over
// range * `span`. Inside `close` meters, damage rises toward `bonus` (point blank).
export const DEFAULT_FALLOFF = { close: 0, bonus: 1, min: 0.5, span: 1.5 };

// ---------- Perks ----------
export const PERKS = {
  rampage: { name: 'Rampage', desc: 'Kills grant stacking +12% damage (x3) for 5s.' },
  killclip: { name: 'Kill Clip', desc: 'Reloading within 3s of a kill grants +30% damage for 5s.' },
  outlaw: { name: 'Outlaw', desc: 'Precision kills greatly increase reload speed for 6s.' },
  extmag: { name: 'Extended Mag', desc: '+30% magazine size.' },
  firefly: { name: 'Firefly', desc: 'Precision kills cause a solar explosion.' },
  leech: { name: 'Vampire Touch', desc: 'Kills restore 20 health.' },
  steady: { name: 'Steady Hands', desc: '35% less spread and recoil.' },
  hotswap: { name: 'Quickdraw', desc: 'Much faster weapon swap and 15% faster reload.' },
  highcal: { name: 'High-Caliber Rounds', desc: '+10% damage.' },
  precise: { name: 'Precision Instrument', desc: '+20% precision damage.' },
  scavenger: { name: 'Scavenger', desc: 'Kills have a chance to refill reserve ammo.' },
  overflow: { name: 'Overflow', desc: 'Ammo pickups overfill the magazine to 2x.' },
  surrounded: { name: 'Surrounded', desc: '+25% damage while 3 or more enemies are within 8m.' },
  opening: { name: 'Opening Shot', desc: 'The first shot after 2s without firing deals +25% damage with much tighter spread.' },
  frenzy: { name: 'Frenzy', desc: 'After 6s of steady fighting: +20% damage and 30% faster reload until you stop for 3s.' },
  feeding: { name: 'Feeding Frenzy', desc: 'Reloading within 3.5s of a kill is 45% faster.' },
  incandescent: { name: 'Incandescent', desc: 'Kills set enemies within 5m burning for 3s.' },
  voltshot: { name: 'Voltshot', desc: 'Reloading within 4s of a kill charges the next hit to jolt up to 3 nearby enemies.' },
  destabilizing: { name: 'Destabilizing Rounds', desc: 'Kills pulse void energy that weakens enemies within 6m, so they take 30% more damage for 4s.' },
  chainreaction: { name: 'Chain Reaction', desc: 'Every kill sets off an elemental explosion.' },
  demolitionist: { name: 'Demolitionist', desc: 'Kills take an extra 2.5s off your grenade cooldown.' },
  snapshot: { name: 'Snapshot Sights', desc: 'Aim down sights twice as fast.' },
  reconstruction: { name: 'Reconstruction', desc: 'After 4s without firing, the magazine refills itself from reserves.' },
  killingwind: { name: 'Killing Wind', desc: 'Kills give +15% movement speed and +25% range for 5s.' },
};
export const EXOTIC_PERKS = {
  chain: { name: 'Lightning Rod', desc: 'Every hit arcs to a nearby enemy for 50% damage.' },
  tracking: { name: 'Seeker', desc: 'Rockets track the nearest enemy.' },
  cluster: { name: 'Cluster Bombs', desc: 'Explosions scatter 4 secondary blasts.' },
  voidheart: { name: 'Cosmology', desc: 'Every kill detonates the target in an explosion of its element.' },
  pierce: { name: 'Overpenetration', desc: 'Shots pierce through every enemy in their path.' },
  sunburst: { name: 'Perfect Fifth', desc: 'Every 5th precision hit detonates and refills the magazine.' },
  thorn: { name: 'Mark of the Devourer', desc: 'Hits poison the target for 4 seconds. Kills spread the poison to up to 3 nearby enemies.' },
  memento: { name: 'Memento Mori', desc: 'Kills instantly refill the magazine and load 6 Memento rounds that deal +50% damage and double Firefly blasts. Reloading also loads them.' },
  explosive: { name: 'Explosive Payload', desc: 'Every hit explodes for extra splash damage.' },
  spinup: { name: 'Spinning Up', desc: 'Holding the trigger ramps up rate of fire (and charge speed) by up to 70%.' },
  whitenail: { name: 'White Nail', desc: 'Three precision hits in a row return 3 rounds to the magazine for free.' },
  shieldbreaker: { name: 'Compressed Impact', desc: 'Shreds enemy shields of any element.' },
  regime: { name: 'SUROS Regime', desc: 'The bottom half of the magazine deals 25% more damage, and every hit with it restores 2 health.' },
  payday: { name: 'Payday', desc: 'Once fully spun up, hits have a 50% chance to put the round back in the magazine.' },
  volatile: { name: 'Volatile Light', desc: 'Every hit bounces to another enemy for 70% damage. Reloading cycles the element between Arc, Solar and Void.' },
  sunshot: { name: 'Sunburn', desc: 'Kills set off a solar blast that leaps to up to 3 nearby enemies.' },
  honed: { name: 'Honed Edge', desc: 'Reload with a full magazine to load every round into one shot that multiplies its damage by the rounds loaded.' },
  siva: { name: 'Parasitic Nanites', desc: 'Precision hits release a SIVA swarm that seeks up to 2 nearby enemies and bursts on them.' },
  conductor: { name: 'Arc Conductor', desc: 'Taking damage charges the gun for 6s: you take 25% less damage, Lightning Rod arcs to 3 enemies, and every other hit refunds a round.' },
  ridebull: { name: 'Ride the Bull', desc: 'Kills refill the magazine and instantly max out Spinning Up.' },
  wolves: { name: 'Release the Wolves', desc: 'Kills unleash the pack for 6s: bursts fire twice as fast and deal 25% more damage.' },
  telesto: { name: 'Unstable Payload', desc: 'Bolts stick to enemies and detonate a second later in a void blast.' },
  merciless: { name: 'Conserve Momentum', desc: 'Kills supercharge the weapon for 4s: shots charge six times faster.' },
  acrius: { name: 'Royal Decree', desc: 'Kills send out an arc shockwave that hits everything within 7m.' },
  sleeper: { name: 'Refraction', desc: 'Each bolt refracts into up to 2 more enemies within 15m for 80% damage.' },
  reign: { name: 'Reign Havoc', desc: 'Every 8th hit calls down a lightning strike on the target.' },
  xeno: { name: 'Scorched Earth', desc: 'Every round is a solar explosion that leaves enemies burning for 3s.' },
  wolfpack: { name: 'Wolfpack Rounds', desc: 'Explosions release 4 wolfpack rounds that hunt down nearby enemies.' },
  truth: { name: "Hunter's Trace", desc: 'Rocket kills instantly reload the launcher from reserves.' },
};
export const PERK_POOL = {
  primary: ['rampage', 'killclip', 'outlaw', 'extmag', 'firefly', 'leech', 'steady', 'hotswap', 'highcal', 'precise', 'surrounded', 'opening', 'frenzy', 'feeding', 'incandescent', 'voltshot', 'destabilizing', 'demolitionist', 'snapshot', 'reconstruction', 'killingwind'],
  special: ['rampage', 'killclip', 'outlaw', 'extmag', 'firefly', 'leech', 'steady', 'hotswap', 'highcal', 'scavenger', 'overflow', 'surrounded', 'opening', 'frenzy', 'feeding', 'incandescent', 'voltshot', 'chainreaction', 'demolitionist', 'snapshot', 'killingwind'],
  heavy: ['rampage', 'killclip', 'extmag', 'leech', 'steady', 'hotswap', 'highcal', 'scavenger', 'overflow', 'frenzy', 'incandescent', 'voltshot', 'chainreaction', 'demolitionist', 'reconstruction'],
};
// Exotics: perks (first one is the signature), stat mods (numbers multiply the roll,
// mode/burst/pellets/charge replace the archetype), and a unique look for the model.
// Slot overrides follow Destiny 2: Legend of Acrius and Whisper of the Worm are Heavy (Power) weapons.
export const EXOTIC_WEAPONS = [
  { name: 'SUROS Regime', arch: 'auto', element: 'kinetic', perks: ['regime', 'spinup'], look: { body: 0xe8e4da, accent: 0xff6a1a, parts: ['stripes'] }, flavor: 'Spin up. Never stop.' },
  { name: 'Sweet Business', arch: 'auto', element: 'kinetic', perks: ['payday', 'spinup', 'overflow'], mods: { mag: 3, spread: 1.3 }, look: { body: 0xc9a046, accent: 0x2a2d33, parts: ['drum'] }, flavor: 'Business is good.' },
  { name: 'Hard Light', arch: 'auto', element: 'arc', perks: ['volatile', 'pierce'], look: { body: 0xf2f2f2, accent: 0x5fd3ff, parts: ['fins'] }, flavor: 'Bounces off walls. Not off enemies.' },
  { name: 'Sunshot', arch: 'hand', element: 'solar', perks: ['sunshot', 'explosive'], look: { body: 0xb33a1e, accent: 0xffc04a, parts: ['sun'] }, flavor: 'Every target becomes a small sun.' },
  { name: 'Thorn', arch: 'hand', element: 'kinetic', perks: ['thorn'], look: { body: 0x2c3a24, accent: 0x6dff8e, parts: ['spikes'] }, flavor: 'To rend one\'s enemies is to see them not as equals.' },
  { name: 'Ace of Spades', arch: 'hand', element: 'kinetic', perks: ['memento', 'firefly'], mods: { rpm: 1.15, reload: 0.8, range: 1.25, spread: 0.75 }, look: { body: 0x1b1d22, accent: 0xffffff, parts: ['spade'] }, flavor: 'Always kept close.' },
  { name: 'Graviton Lance', arch: 'pulse', element: 'void', perks: ['voidheart'], mods: { burst: 2, burstDelay: 0.36, dmg: 1.5 }, look: { body: 0x16141c, accent: 0xb07cff, parts: ['orb'] }, flavor: 'A burst that folds space around the fallen.' },
  { name: 'Outbreak Perfected', arch: 'pulse', element: 'kinetic', perks: ['siva', 'rampage'], look: { body: 0xe8e8e8, accent: 0xd8333a, parts: ['siva'] }, flavor: 'The swarm spreads.' },
  { name: 'Polaris Lance', arch: 'scout', element: 'solar', perks: ['sunburst', 'outlaw'], look: { body: 0x1d2230, accent: 0xffd27a, parts: ['star'] }, flavor: 'Five notes, and the last one burns.' },
  { name: 'Riskrunner', arch: 'smg', element: 'arc', perks: ['conductor', 'chain'], look: { body: 0xe8c840, accent: 0x1b1d22, parts: ['hazard'] }, flavor: 'Ride the lightning.' },
  { name: 'The Huckleberry', arch: 'smg', element: 'arc', perks: ['ridebull', 'spinup'], look: { body: 0x8a5a2b, accent: 0x5fd3ff, parts: ['bull'] }, flavor: 'Keep the trigger down and it never stops.' },
  { name: 'Lord of Wolves', arch: 'shotgun', element: 'solar', perks: ['wolves'], mods: { mode: 'burst', burst: 5, burstDelay: 0.45, pellets: 4, rpm: 8.5, mag: 4, range: 1.5 }, look: { body: 0x1b1d22, accent: 0xd8333a, parts: ['jaw'] }, flavor: 'The pack hunts as one.' },
  { name: 'Izanagi\'s Burden', arch: 'sniper', element: 'kinetic', perks: ['honed'], mods: { dmg: 1.15 }, look: { body: 0x23354f, accent: 0xd8333a, parts: ['blade'] }, flavor: 'One shot, all of it.' },
  { name: 'Telesto', arch: 'fusion', element: 'void', perks: ['telesto'], look: { body: 0x2a3a6a, accent: 0xb07cff, parts: ['crystal'] }, flavor: 'Nobody knows why it works. Nobody asks.' },
  { name: 'Merciless', arch: 'fusion', element: 'solar', perks: ['merciless', 'spinup'], look: { body: 0xeeeeee, accent: 0xffc04a, parts: ['coils'] }, flavor: 'It never stops charging.' },
  { name: 'Legend of Acrius', arch: 'shotgun', element: 'arc', slot: 'heavy', perks: ['acrius', 'pierce'], mods: { pellets: 14, dmg: 1.2 }, look: { body: 0xc9a046, accent: 0x5fd3ff, parts: ['ornate'] }, flavor: 'A king\'s weapon, built to end arguments.' },
  { name: 'Whisper of the Worm', arch: 'sniper', element: 'void', slot: 'heavy', perks: ['whitenail', 'pierce'], look: { body: 0xd9d2bd, accent: 0x6dff8e, parts: ['wings'] }, flavor: 'It hungers for one more shot.' },
  { name: 'Sleeper Simulant', arch: 'linear', element: 'solar', perks: ['sleeper'], look: { body: 0xb8bcc4, accent: 0xd8333a, parts: ['stripes'] }, flavor: 'A single line that bends to find its mark.' },
  { name: 'Arbalest', arch: 'linear', element: 'kinetic', perks: ['shieldbreaker'], mods: { dmg: 1.1 }, look: { body: 0xd0d4da, accent: 0xff6a1a, parts: ['fins'] }, flavor: 'Built to break shields.' },
  { name: 'Thunderlord', arch: 'mg', element: 'arc', perks: ['reign', 'spinup'], look: { body: 0x1b1d22, accent: 0x5fd3ff, parts: ['prongs'] }, flavor: 'The longer it sings, the louder the storm.' },
  { name: 'Xenophage', arch: 'mg', element: 'solar', perks: ['xeno'], mods: { rpm: 0.2, dmg: 4.5, mag: 0.25 }, look: { body: 0x2a1c18, accent: 0xff8b2b, parts: ['mouth'] }, flavor: 'Every round a small explosion.' },
  { name: 'Gjallarhorn', arch: 'rocket', element: 'solar', perks: ['wolfpack', 'tracking'], look: { body: 0xc9a046, accent: 0xff8b2b, parts: ['wolf'] }, flavor: 'Wolves run in packs.' },
  { name: 'Truth', arch: 'rocket', element: 'void', perks: ['truth', 'tracking'], look: { body: 0x2a2d33, accent: 0xb07cff, parts: ['skull'] }, flavor: 'It finds you.' },
  { name: 'The Prospector', arch: 'glauncher', element: 'arc', perks: ['cluster'], mods: { mag: 2 }, look: { body: 0xe8c840, accent: 0x5fd3ff, parts: ['hazard'] }, flavor: 'Strike it rich.' },
];
/** Special-ammo weapon types re-slotted as Heavy hit harder and carry less ammo. */
export const HEAVY_VERSION = { dmg: 1.4, reserve: 10, brick: 3 };
// Rolled perk on Legendary armor (one per piece; the same perk on several pieces stacks)
export const ARMOR_PERKS = {
  grenadier: { name: 'Grenadier', desc: 'Grenade recharges 15% faster.' },
  brawler: { name: 'Brawler', desc: 'Powered melee recharges 15% faster.' },
  kickstart: { name: 'Utility Kickstart', desc: 'Class ability recharges 20% faster.' },
  dynamo: { name: 'Dynamo', desc: 'Super charges 12% faster.' },
  recuperation: { name: 'Recuperation', desc: 'Kills restore 15 health.' },
  handson: { name: 'Hands-On', desc: 'Melee and ability kills give extra super energy.' },
  plating: { name: 'Resilient Plating', desc: 'Take 8% less damage.' },
  reserves: { name: 'Ammo Reserves', desc: '+20% reserve ammo for special and heavy weapons.' },
};

// What each exotic armor piece does (works on any class)
export const EXOTIC_ARMOR_PERKS = {
  'Celestial Nighthawk': { id: 'nighthawk', name: 'Hawkeye Hack', desc: 'The first hit of your super deals 4x damage. Golden Gun becomes a single shot that deals 6x damage.' },
  Synthoceps: { id: 'synthoceps', name: 'Biotic Enhancements', desc: 'Melee abilities and melee supers deal double damage while 3 or more enemies are within 12m. Your powered melee recharges 25% faster.' },
  'Heart of Inmost Light': { id: 'heart', name: 'Overflowing Light', desc: 'Using an ability empowers your other two for 8s: they recharge 60% faster and deal 30% more damage.' },
  'St0mp-EE5': { id: 'stomp', name: 'Hydraulic Boosters', desc: 'Jump 30% higher, move 8% faster, and your class ability recharges 30% faster.' },
  'An Insurmountable Skullfort': { id: 'skullfort', name: 'Cranial Spike', desc: 'Kills with your powered melee fully recharge it and restore your health.' },
  "Nezarec's Sin": { id: 'nezarec', name: 'Abyssal Extractors', desc: 'Ability kills make all of your abilities recharge twice as fast for 5s.' },
  'Ophidian Aspect': { id: 'ophidian', name: 'Cobra Totem', desc: 'Reload 35% faster, swap weapons faster, and your melee lunges 50% farther.' },
  'Contraverse Hold': { id: 'contraverse', name: 'Chaos Accelerant', desc: 'Grenades that catch enemies refund 30% of their cooldown. Take 20% less damage for 3s after throwing one.' },
  'Actium War Rig': { id: 'actium', name: 'Auto-Loading Link', desc: 'While you fire, your weapon loads a round from reserves every 0.4s.' },
  Armamentarium: { id: 'armamentarium', name: 'Pocket Arsenal', desc: 'Your grenade gains a second charge.' },
  'Transversive Steps': { id: 'transversive', name: 'Strategic Relocation', desc: 'Sprint 15% faster. Sprinting for a moment reloads the weapon in your hands.' },
  Dunemarchers: { id: 'dunemarchers', name: 'Linear Actuators', desc: 'Sprinting builds static. Your next melee chains lightning into up to 3 enemies.' },
};
export const EXOTIC_ARMOR = {
  helmet: ['Celestial Nighthawk', 'An Insurmountable Skullfort', "Nezarec's Sin"],
  arms: ['Synthoceps', 'Ophidian Aspect', 'Contraverse Hold'],
  chest: ['Heart of Inmost Light', 'Actium War Rig', 'Armamentarium'],
  legs: ['St0mp-EE5', 'Transversive Steps', 'Dunemarchers'],
};

// ---------- Classes ----------
export const CLASSES = {
  vanguard: {
    id: 'vanguard', name: 'Titan', color: '#ff8b2b',
    base: { mob: 2, res: 7, rec: 3 }, jump: 'lift', jumpName: 'Catapult Lift (hold Space in air)',
    subclasses: {
      sunbreaker: {
        name: 'Sunbreaker', element: 'solar', color: '#ff8b2b', tagline: 'Walls, hammers, and fire.',
        abilities: {
          grenade: { id: 'pulse', name: 'Solar Grenade', cd: 22, desc: 'Lands and pulses solar fire six times.' },
          melee: { id: 'hammerthrow', name: 'Throwing Hammer', cd: 10, desc: 'Hurl a solar hammer. Walk over it after it lands to pick it up: your melee recharges instantly and you heal.' },
          class: { id: 'barricade', name: 'Towering Barricade', cd: 26, desc: 'Raise a wall that blocks enemy fire for the whole fireteam and reloads your weapons.' },
          super: { id: 'hammers', name: 'Hammer of Sol', desc: 'For 15s hurl explosive solar hammers and take 40% less damage.' },
        },
      },
      striker: {
        name: 'Striker', element: 'arc', color: '#5fd3ff', tagline: 'Charge in and hit like lightning.',
        abilities: {
          grenade: { id: 'pulse', name: 'Pulse Grenade', cd: 20, desc: 'Lands and pulses arc damage six times.' },
          melee: { id: 'charge', name: 'Shoulder Charge', cd: 9, desc: 'Sprint-tackle forward, slamming the first enemy you hit.' },
          class: { id: 'barricade', name: 'Towering Barricade', cd: 26, desc: 'Raise a wall that blocks enemy fire for the whole fireteam and reloads your weapons.' },
          super: { id: 'fists', name: 'Fists of Havoc', desc: 'For 14s, each click is a lunging arc slam. Take 50% less damage and move faster.' },
        },
      },
      sentinel: {
        name: 'Sentinel', unlockLevel: 10, element: 'void', color: '#b07cff', tagline: 'A shield for the fireteam. Overshields and suppression.',
        passive: 'Void abilities grant you an overshield.',
        abilities: {
          grenade: { id: 'suppressor', name: 'Suppressor Grenade', cd: 22, desc: 'Explodes and suppresses enemies: they cannot attack for 4s and take extra damage.' },
          melee: { id: 'shieldthrow', name: 'Shield Throw', cd: 11, desc: 'Throw your shield to ricochet through up to 3 enemies. Grants an overshield.' },
          class: { id: 'ward', name: 'Bastion Ward', cd: 34, desc: 'Raise a dome for 8s that destroys enemy shots and refreshes the overshield of everyone inside.' },
          super: { id: 'sentinel', name: 'Sentinel Shield', desc: 'For 15s: click to throw a shield that ricochets through enemies and returns, hold right-click to guard, F to bash.' },
        },
      },
    },
  },
  stalker: {
    id: 'stalker', name: 'Hunter', color: '#ffb547',
    base: { mob: 7, res: 2, rec: 3 }, jump: 'double', jumpName: 'Triple Jump (press Space in air)',
    subclasses: {
      gunslinger: {
        name: 'Gunslinger', element: 'solar', color: '#ffb547', tagline: 'Dodges, knives, and the Golden Gun.',
        abilities: {
          grenade: { id: 'swarm', name: 'Swarm Grenade', cd: 20, desc: 'Detonates and sends seekers into up to 4 nearby enemies.' },
          melee: { id: 'knife', name: 'Knife Trick', cd: 9, desc: 'Throw a flaming knife. Precision hits deal double damage.' },
          class: { id: 'dodge', name: "Gambler's Dodge", cd: 10, desc: 'Dash in your movement direction and instantly reload.' },
          super: { id: 'revolver', name: 'Golden Gun', desc: 'Six devastating solar shots that burn nearby enemies.' },
        },
      },
      nightstalker: {
        name: 'Nightstalker', element: 'void', color: '#b07cff', tagline: 'Smoke, invisibility, and tethers.',
        abilities: {
          grenade: { id: 'axion', name: 'Axion Bolt', cd: 20, desc: 'Releases two void bolts that hunt down enemies.' },
          melee: { id: 'snare', name: 'Snare Bomb', cd: 10, desc: 'Throw a smoke bomb that sticks, then bursts into a cloud that slows and weakens enemies.' },
          class: { id: 'vanish', name: 'Vanishing Step', cd: 12, desc: 'Dodge, reload, and turn invisible for 4s. Enemies lose track of you.' },
          super: { id: 'tether', name: 'Shadowshot', desc: 'Three void arrows that tether enemies: pulled, slowed, weakened, and burned.' },
        },
      },
      arcstrider: {
        name: 'Arcstrider', unlockLevel: 10, element: 'arc', color: '#5fd3ff', tagline: 'Up close and never still. Dodge, strike, repeat.',
        passive: 'Dodging recharges your melee; melee kills fully heal you.',
        abilities: {
          grenade: { id: 'flux', name: 'Flux Grenade', cd: 20, desc: 'Sticks to the first enemy it hits and detonates, jolting lightning into two more.' },
          melee: { id: 'combo', name: 'Combination Blow', cd: 9, desc: 'Lunging arc strike. A kill fully heals you and refunds half the melee.' },
          class: { id: 'gambler', name: "Gambler's Dodge", cd: 9, desc: 'Dodge and fully recharge your melee. Your next melee within 4s hits twice as hard and chains.' },
          super: { id: 'staff', name: 'Arc Staff', desc: 'For 14s, wield a staff: three-hit combos with a shockwave finisher, dodge freely with C, and take 55% less damage.' },
        },
      },
    },
  },
  arcanist: {
    id: 'arcanist', name: 'Warlock', color: '#b07cff',
    base: { mob: 3, res: 3, rec: 7 }, jump: 'glide', jumpName: 'Burst Glide (press Space in air)',
    subclasses: {
      voidwalker: {
        name: 'Voidwalker', element: 'void', color: '#b07cff', tagline: 'Heal, drain, and annihilate.',
        abilities: {
          grenade: { id: 'vortex', name: 'Vortex Grenade', cd: 24, desc: 'Creates a void singularity that pulls and shreds enemies.' },
          melee: { id: 'siphon', name: 'Energy Drain', cd: 11, desc: 'Ranged void strike that restores health and shields.' },
          class: { id: 'rift', name: 'Healing Rift', cd: 32, desc: 'Conjure a well that heals everyone inside and speeds reloads.' },
          super: { id: 'nova', name: 'Nova Bomb', desc: 'Hurl a massive ball of void energy that erases everything it hits.' },
        },
      },
      stormcaller: {
        name: 'Stormcaller', unlockLevel: 10, element: 'arc', color: '#5fd3ff', tagline: 'Call down the storm.',
        abilities: {
          grenade: { id: 'storm', name: 'Storm Grenade', cd: 22, desc: 'Summons a storm cloud that strikes every enemy below with lightning.' },
          melee: { id: 'chainl', name: 'Chain Lightning', cd: 10, desc: 'Ranged arc strike that jumps to three more enemies.' },
          class: { id: 'empower', name: 'Empowering Rift', cd: 32, desc: 'Conjure a well that gives everyone inside +25% weapon damage.' },
          super: { id: 'stormtrance', name: 'Stormtrance', desc: 'For 12s, hold fire to pour chain lightning from your hands.' },
        },
      },
      dawnblade: {
        name: 'Dawnblade', element: 'solar', color: '#ffb547', tagline: 'Fire that heals. Abilities that never stop.',
        passive: 'Your abilities grant Restoration: health and shields regenerate for a few seconds.',
        abilities: {
          grenade: { id: 'pulse', name: 'Solar Grenade', cd: 12, desc: 'A lingering ball of solar fire that burns everything near it. During Song of Flame it has no cooldown: throw as many as you like and they all burn at once.' },
          melee: { id: 'snap', name: 'Incinerator Snap', cd: 9, desc: 'Snap your fingers: three explosions burst down a line ahead and set enemies burning.' },
          class: { id: 'phoenix', name: 'Phoenix Dive', cd: 16, desc: 'In the air, dive to the ground in a solar burst. Always heals you and grants Restoration.' },
          super: { id: 'songflame', name: 'Song of Flame', desc: 'For 10s keep your guns: grenades and melees recharge 4x faster, your weapons deal 30% more damage, and nearby allies are empowered.' },
        },
      },
    },
  },
};

/** Merged class + subclass data. Falls back to the class's first subclass. */
export function classKit(classId, subId) {
  const c = CLASSES[classId];
  const ids = Object.keys(c.subclasses);
  const sid = c.subclasses[subId] ? subId : ids[0];
  const sub = c.subclasses[sid];
  return { ...c, ...sub, className: c.name, subclassId: sid, subclass: sub.name, color: sub.color };
}

// ---------- Enemies ----------
export const ENEMY_TYPES = {
  grunt: { hp: 95, speed: 3.4, range: 26, prefer: 14, fireCd: [1.9, 3.0], burst: 3, burstGap: 0.14, dmg: 6, projSpeed: 26, shotSize: 0.11, scale: 1.0 },
  rusher: { hp: 70, speed: 7.2, melee: true, meleeDmg: 16, scale: 0.9 },
  captain: { hp: 300, shield: 180, speed: 3.8, range: 30, prefer: 16, fireCd: [1.6, 2.6], burst: 5, burstGap: 0.1, dmg: 7, projSpeed: 30, shotSize: 0.12, scale: 1.2 },
  heavy: { hp: 900, speed: 2.3, range: 34, prefer: 13, fireCd: [2.8, 3.8], burst: 1, burstGap: 0.2, dmg: 26, projSpeed: 17, shotSize: 0.3, splash: 3, scale: 1.65 },
  boss: { hp: 5200, shield: 1500, speed: 2.6, range: 45, prefer: 16, fireCd: [1.6, 2.4], burst: 5, burstGap: 0.12, dmg: 12, projSpeed: 24, shotSize: 0.22, splash: 2.5, scale: 2.6 },
};

// ---------- Locations ----------
export const LOCATIONS = [
  {
    id: 'earth', name: 'The Cosmodrome', planetName: 'Earth', faction: 'Fallen',
    desc: 'The rusted launch yards of Old Russia, where humanity once reached for the stars. House of Devils Fallen pick through the wreckage of the Golden Age.',
    fog: [40, 190], sunDir: [0.6, 1, 0.35], light: { hemi: 1.6, sun: 2.4 },
    colors: { sky: 0xe7b585, fog: 0xdcaa7c, hemiTop: 0xffe3bd, hemiBot: 0x5e4a36, sun: 0xfff1d8, ground: 0x9c7d57, ground2: 0x8a6c47, rock: 0x7f6f5f, rock2: 0x675a4c, wall: 0x8c8378, metal: 0x6d7279, accent: 0xb0562c, crate: 0x7a8a5a, foliage: 0x3f5a3a, enemy: 0x46627f, enemy2: 0x262f3a, eye: 0x7fd8ff },
    planetColors: { sea: true, c: [0x2b5d8f, 0x3f7d4a, 0x8a7350, 0xe2e2e2] }, atmo: 0x6fb2ff,
    skyBody: { color: 0xeaeef2, size: 38, pos: [-260, 150, -420] },
    enemyNames: { grunt: 'Vandal', rusher: 'Dreg', captain: 'Fallen Captain', heavy: 'Fallen Brig' },
    zoneNames: ['The Steppes', 'Skywatch', 'The Divide', 'Forgotten Shore', 'Rocketyard', 'Mothyards'],
    missions: [
      { id: 'e1', mood: 'dawn', name: 'A Guardian Rises', power: 10, zones: 3, boss: { name: 'Riksis, Devil Archon', element: 'arc' , model: 'archon' }, desc: 'Your Ghost has brought you back. Fight through the Fallen and get to the Wall.' },
      { id: 'e2', mood: 'day', name: 'The Last Array', power: 20, zones: 3, boss: { name: 'Sepiks Prime', element: 'solar' , model: 'servitor' }, desc: 'Restore the old Rasputin array and reach out to the stars.' },
      { id: 'e3', mood: 'dusk', name: "The Devils' Lair", power: 30, zones: 4, boss: { name: 'Draksis, Winter Kell', element: 'void' , model: 'kell' }, desc: 'Strike at the heart of the House of Devils and bring down their Kell.' },
    ],
  },
  {
    id: 'moon', name: 'The Hellmouth', planetName: 'Moon', faction: 'Hive',
    desc: 'The Hive have carved a fortress into the Moon. Below the Hellmouth, the brood of Crota waits in the dark.',
    fog: [30, 165], sunDir: [-0.4, 1, 0.5], light: { hemi: 1.7, sun: 2.0 },
    colors: { sky: 0x0b0e16, fog: 0x161c29, hemiTop: 0xaab6cc, hemiBot: 0x2a2e36, sun: 0xd8e4ff, ground: 0x9da2a8, ground2: 0x8a8f95, rock: 0x6c7177, rock2: 0x575c62, wall: 0x7d7f86, metal: 0x50555d, accent: 0x58ff9c, crate: 0x5c6a62, foliage: 0x3b4a44, enemy: 0xd6cfb8, enemy2: 0x3a382f, eye: 0x6dff8e },
    planetColors: { sea: false, c: [0x5d6268, 0x7d8288, 0x9ea3a8, 0xc8ccd0] }, atmo: 0x9fb4d0,
    skyBody: { color: 0x4d8fd8, size: 60, pos: [200, 120, -400] },
    enemyNames: { grunt: 'Acolyte', rusher: 'Thrall', captain: 'Knight', heavy: 'Ogre' },
    zoneNames: ["Archer's Line", 'Anchor of Light', 'Hellmouth', 'Temple of Crota', 'Gatehouse', "World's Grave"],
    missions: [
      { id: 'm1', mood: 'night', name: 'The Dark Beyond', power: 40, zones: 3, boss: { name: 'Sardok, Eye of Oryx', element: 'void' , model: 'knight' }, desc: 'Follow the trail of a lost Guardian into the Hive tunnels.' },
      { id: 'm2', mood: 'night', name: 'Chamber of Night', power: 50, zones: 4, boss: { name: 'Omnigul, Will of Crota', element: 'arc' , model: 'wizard' }, desc: 'Silence the wizard whose screams carry Crota\'s will across the Moon.' },
      { id: 'm3', mood: 'storm', name: "Crota's End", power: 60, zones: 4, boss: { name: 'Crota, Son of Oryx', element: 'solar' , model: 'crota' }, desc: 'Descend into the Hellmouth and end the god-prince of the Hive.' },
    ],
  },
  {
    id: 'mars', name: 'Meridian Bay', planetName: 'Mars', faction: 'Cabal',
    desc: 'The Cabal Sand Eaters hold the red dunes of Mars. Their soldiers are bigger, their walls are thicker, and their guns are much bigger.',
    fog: [40, 190], sunDir: [0.3, 1, -0.4], light: { hemi: 1.5, sun: 2.5 },
    colors: { sky: 0xe39a6b, fog: 0xd98c5e, hemiTop: 0xffd2b0, hemiBot: 0x5c2c1c, sun: 0xfff0da, ground: 0xc0633b, ground2: 0xa9542f, rock: 0x8a3f25, rock2: 0x70321f, wall: 0x9a7d6a, metal: 0x5c5651, accent: 0xffcb47, crate: 0x6e5e4a, foliage: 0x5b3a2a, enemy: 0x8b2c24, enemy2: 0x3a2420, eye: 0xffb347 },
    planetColors: { sea: false, c: [0x7a3420, 0xb3552f, 0xd07a45, 0xe8c4a0] }, atmo: 0xff9a6a,
    skyBody: { color: 0xbfa898, size: 18, pos: [-200, 170, -380] },
    enemyNames: { grunt: 'Legionary', rusher: 'War Beast', captain: 'Centurion', heavy: 'Colossus' },
    zoneNames: ['The Barrens', 'Scablands', 'The Buried City', 'Dust Palace', 'Valley of Kings', 'Hollows'],
    missions: [
      { id: 'r1', mood: 'day', name: 'The Buried City', power: 70, zones: 4, boss: { name: 'Valus Ta\'aurc', element: 'solar' , model: 'valus' }, desc: 'Push through the Cabal lines into the ruins buried under the sand.' },
      { id: 'r2', mood: 'dusk', name: 'Dust Palace', power: 80, zones: 4, boss: { name: 'Bracus Zahn', element: 'void' , model: 'bracus' }, desc: 'Storm the Cabal command post and bring down the Bracus who holds it.' },
      { id: 'r3', mood: 'storm', name: 'The Red War', power: 90, zones: 5, boss: { name: 'Dominus Ghaul', element: 'arc' , model: 'ghaul' }, desc: 'The Red Legion\'s commander has come for the Light. Send him back to the dark.' },
    ],
  },
  {
    id: 'titan', name: 'New Pacific Arcology', planetName: 'Titan', faction: 'Hive', sea: true,
    desc: 'A Golden Age city on stilts rises out of the methane seas of Saturn\'s largest moon. The Hive have nested in its flooded towers.',
    fog: [24, 150], sunDir: [-0.3, 1, 0.6], light: { hemi: 1.7, sun: 1.6 },
    colors: { sky: 0x9fb5a9, fog: 0xa9bcae, hemiTop: 0xd8e6dc, hemiBot: 0x3a4a44, sun: 0xfff4e0, ground: 0x6f7a74, ground2: 0x5f6a64, rock: 0x4f5a55, rock2: 0x414b47, wall: 0xc9cfcb, metal: 0x7a8580, accent: 0xffc56a, crate: 0x8a7a5a, foliage: 0x3b4a44, sea: 0x2f4f4a, enemy: 0xd6cfb8, enemy2: 0x2a2d2a, eye: 0x6dff8e },
    planetColors: { sea: true, c: [0x2f4a46, 0x8c7a52, 0xb59a62, 0xdcc48e] }, atmo: 0xe8c890,
    skyBody: { color: 0xe0c89a, size: 80, pos: [300, 170, -420], ring: true },
    enemyNames: { grunt: 'Acolyte', rusher: 'Thrall', captain: 'Knight', heavy: 'Ogre' },
    zoneNames: ['The Rig', "Siren's Watch", 'The Solarium', 'Arcology Interior', 'The Methane Sea', 'Spine of Keres'],
    missions: [
      { id: 't1', mood: 'storm', name: 'Hope', power: 100, zones: 4, boss: { name: 'Kathok, Swordbearer', element: 'arc' , model: 'swordbearer' }, desc: 'Find the Guardians holed up in the Arcology and break the Hive siege on the rigs.' },
      { id: 't2', mood: 'day', name: 'The Sunken Labs', power: 110, zones: 4, boss: { name: 'Ir Halak, Brood Wizard', element: 'void' , model: 'broodwizard' }, desc: 'Push into the flooded labs where the Hive are growing something in the dark.' },
      { id: 't3', mood: 'dusk', name: "Savathûn's Song", power: 120, zones: 5, boss: { name: "Sedrak, Song of Savathûn", element: 'solar' , model: 'shrieker' }, desc: 'Silence the Hive choir singing Savathûn\'s song beneath the Arcology.' },
    ],
  },
  {
    id: 'tangled', name: 'The Tangled Shore', planetName: 'The Reef', faction: 'Fallen',
    desc: 'A lawless snarl of asteroids lashed together with Fallen cable and scrap. The Spider runs the markets; Uldren\'s Barons run everything else.',
    fog: [34, 175], sunDir: [0.5, 1, 0.2], light: { hemi: 1.6, sun: 2.1 },
    colors: { sky: 0x8a78a8, fog: 0x7c6c98, hemiTop: 0xeadcff, hemiBot: 0x3a2e38, sun: 0xffe2c4, ground: 0x7a5e52, ground2: 0x6a5048, rock: 0x5e4842, rock2: 0x4a3a36, wall: 0x6e6460, metal: 0x58606a, accent: 0xff9a3c, crate: 0x6a5a48, foliage: 0x4a3a4a, enemy: 0x5a4a78, enemy2: 0x241e2c, eye: 0xc37aff },
    planetColors: { sea: false, c: [0x3a2e3a, 0x6a5048, 0x8a7a6a, 0xb8a890] }, atmo: 0xb89aff,
    skyBody: { color: 0xd8c8b0, size: 34, pos: [-240, 150, -400] },
    enemyNames: { grunt: 'Vandal', rusher: 'Dreg', captain: 'Baron\'s Captain', heavy: 'Fallen Brig' },
    zoneNames: ["Thieves' Landing", 'The Rift', 'Four-Holed Cove', "Trapper's Cave", 'Jetsam of Saturn', 'Spider\'s Market'],
    missions: [
      { id: 'ts1', mood: 'dusk', name: 'The Trickster', power: 130, zones: 3, boss: { name: 'Araskes, the Trickster', element: 'arc' , model: 'baron' }, desc: 'Chase one of Uldren\'s Barons through the scrap alleys of Thieves\' Landing. Mind the mines.' },
      { id: 'ts2', mood: 'night', name: 'The Mindbender', power: 140, zones: 4, boss: { name: 'Reksis Vahn, the Mindbender', element: 'void' , model: 'mindbender' }, desc: 'Follow the Mindbender\'s Hive-tainted crew down through the Rift to his ritual cavern.' },
      { id: 'ts3', mood: 'storm', name: 'Scorned', power: 150, zones: 4, boss: { name: 'Fikrul, the Fanatic', element: 'solar' , model: 'fanatic' }, desc: 'Cross the wreck fields of Jetsam of Saturn and end the Fanatic who raises the Scorn.' },
    ],
  },
  {
    id: 'io', name: 'Io', planetName: 'Io', faction: 'Cabal',
    desc: 'The moon the Traveler touched last, sulfur-yellow under the bulk of Jupiter. The Red Legion drill for its secrets, the Taken stalk the Rupture and the Vex guard the Pyramidion.',
    fog: [36, 190], sunDir: [0.6, 1, -0.3], light: { hemi: 1.7, sun: 2.2 },
    colors: { sky: 0xd8c08a, fog: 0xc8b07a, hemiTop: 0xfff0c8, hemiBot: 0x5a3e26, sun: 0xfff2d0, ground: 0xc9b46a, ground2: 0xb39a52, rock: 0x9a5a34, rock2: 0x6e3e26, wall: 0x8a8478, metal: 0x55504a, accent: 0xff5a2a, crate: 0x6a5a40, foliage: 0x5ab8a8, enemy: 0x7a3a2a, enemy2: 0x2a1c18, eye: 0xff7a3a },
    planetColors: { sea: false, c: [0x8a5a2a, 0xc9a24a, 0xe2cf7a, 0xf4ecc0] }, atmo: 0xffe08a,
    skyBody: { color: 0xd8a878, size: 120, pos: [-320, 190, -460] },
    enemyNames: { grunt: 'Legionary', rusher: 'War Beast', captain: 'Centurion', heavy: 'Colossus' },
    zoneNames: ['Lost Oasis', "Giant's Scar", 'The Rupture', 'Terrabase Charon', 'Echo Mesa', 'Excavation Site XII', 'Aphix Conduit', 'The Pyramidion'],
    missions: [
      { id: 'io1', mood: 'dawn', name: 'Sacred Ground', power: 160, zones: 3, boss: { name: 'Malok-Ra, Taken Captain', element: 'void', model: 'takencaptain' }, desc: 'Cross the Lost Oasis and Giant\'s Scar to the Rupture, where the Taken have gathered at the Traveler\'s last touch.' },
      { id: 'io2', mood: 'day', name: 'Echo Mesa', power: 170, zones: 4, boss: { name: 'The Psion Flayers', element: 'solar', model: 'psionflayer' }, desc: 'Break the Red Legion lines from Terrabase Charon to the great drill and silence the Psions running it.' },
      { id: 'io3', mood: 'night', name: 'The Pyramidion', power: 180, zones: 4, boss: { name: 'Protheon, Modular Mind', element: 'arc', model: 'vexmind' }, desc: 'Descend past Excavation Site XII into the Vex Pyramidion and take apart the Mind that guards it.' },
    ],
  },
];

// ---------- Activities ----------
// Wave modes played on the mission maps' boss arenas; every 10th wave is that arena's boss.
export const ACTIVITIES = [
  { id: 'horde', name: 'Horde', waves: 30, chestEvery: 5, arenaEvery: 10, desc: 'Survive 30 waves. A cache every 5 waves, a new arena and its boss every 10, and a guaranteed exotic at the end.' },
  { id: 'endless', name: 'Endless', waves: Infinity, chestEvery: 5, arenaEvery: 10, desc: 'The waves never stop and keep getting harder. A cache every 5 waves, a new arena every 10, and past wave 30 a guaranteed exotic every 10 waves. How long can you last?' },
];

export const CONTROLS = [
  ['WASD', 'Move'], ['Shift', 'Sprint'], ['Space', 'Jump / class jump'], ['Mouse', 'Look'],
  ['LMB', 'Fire'], ['RMB', 'Aim down sights'], ['R', 'Reload'], ['1 2 3 / Wheel', 'Switch weapon'],
  ['Q', 'Grenade'], ['V', 'Melee'], ['Hold E', 'Revive a teammate'], ['F', 'Charged melee ability'], ['C', 'Class ability'], ['X', 'Super'], ['E', 'Interact'], ['I', 'Inventory (swap weapons)'], ['Esc', 'Pause'],
];
