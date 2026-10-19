import { CLASS_BASE } from './armor.js';
// ---------- Elements & rarity ----------
// `symbol`: inner SVG markup (viewBox 0 0 64 64, filled with currentColor) for icons and the HUD.
export const ELEMENTS = {
  kinetic: { id: 'kinetic', name: 'Kinetic', color: '#dfe6ee', hex: 0xdfe6ee, symbol: '<path d="M32 6 54 28 32 58 10 28z" fill-opacity="0.25"/><path d="M32 6 54 28 32 58 10 28zm0 10L18 29l14 19 14-19z"/>' },
  solar: { id: 'solar', name: 'Solar', color: '#ff8b2b', hex: 0xff8b2b, symbol: '<circle cx="32" cy="32" r="11"/><path d="M32 2l4 13h-8zM32 62l-4-13h8zM2 32l13-4v8zM62 32l-13 4v-8zM11 11l12 6-6 6zM53 53l-12-6 6-6zM53 11l-6 12-6-6zM11 53l6-12 6 6z"/>' },
  arc: { id: 'arc', name: 'Arc', color: '#5fd3ff', hex: 0x5fd3ff, symbol: '<path d="M38 2 12 36h16l-6 26 30-36H36z"/>' },
  void: { id: 'void', name: 'Void', color: '#b07cff', hex: 0xb07cff, symbol: '<path d="M32 4a28 28 0 1 0 0.1 0zm0 8a20 20 0 1 1-0.1 0z"/><path d="M32 18 46 42H18z"/>' },
  stasis: { id: 'stasis', name: 'Stasis', color: '#4d88ff', hex: 0x4d88ff, symbol: '<path d="M32 2 40 20 32 30 24 20zM32 62 24 44 32 34 40 44zM6 17l19 3 5 11-12-1zM58 47l-19-3-5-11 12 1zM6 47l11-15h12l-8 10zM58 17 47 32H35l8-10z"/>' },
  strand: { id: 'strand', name: 'Strand', color: '#35e366', hex: 0x35e366, symbol: '<path d="M32 4c10 8 10 20 0 28-10-8-10-20 0-28zm0 6c-4 6-4 12 0 16 4-4 4-10 0-16z"/><path d="M8 50c3-12 14-18 24-18-2 12-12 20-24 18zm6-4c8 0 13-4 15-10-6 1-12 4-15 10z"/><path d="M56 50c-12 2-22-6-24-18 10 0 21 6 24 18zm-6-4c-3-6-9-9-15-10 2 6 7 10 15 10z"/>' },
};
// Energy elements a non-exotic weapon can roll (Kinetic is primary-only). Stasis and Strand have no verbs yet (U17).
export const ENERGY = ['solar', 'arc', 'void', 'stasis', 'strand'];
// Enemy shields stay Light elements until Darkness (U17).
export const SHIELD_ELEMENTS = ['solar', 'arc', 'void'];

export const RARITIES = [
  { id: 'common', name: 'Common', color: '#c9ced4', hex: 0xc9ced4, perks: 0, mult: 1.0 },
  { id: 'uncommon', name: 'Uncommon', color: '#45b764', hex: 0x45b764, perks: 1, mult: 1.04 },
  { id: 'rare', name: 'Rare', color: '#4d8fe0', hex: 0x4d8fe0, perks: 2, mult: 1.08 },
  { id: 'legendary', name: 'Legendary', color: '#a066ea', hex: 0xa066ea, perks: 3, mult: 1.13 },
  { id: 'exotic', name: 'Exotic', color: '#f4c542', hex: 0xf4c542, perks: 2, mult: 1.3 },
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
// H3: Auto Rifles 600 to 650 RPM, Fusion Rifles 70 to 80, SMG range 20 to 15 m, Shotguns 23 to 22 damage
// with a smaller point-blank bonus (1.3 to 1.15) and range 12 to 9 m, heavy weapons +10% damage.
export const ARCHETYPES = {
  auto: { id: 'auto', name: 'Auto Rifle', slot: 'primary', dmg: 15, rpm: 650, mode: 'auto', mag: 34, reload: 1.9, spread: 0.028, ads: 0.0038, zoom: 1.35, prec: 1.6, range: 38, recoil: 0.010, bloom: 0.003 },
  hand: { id: 'hand', name: 'Hand Cannon', slot: 'primary', dmg: 60, rpm: 140, mode: 'semi', mag: 11, reload: 1.7, spread: 0.014, ads: 0.001, zoom: 1.45, prec: 2.0, range: 32, recoil: 0.045 },
  pulse: { id: 'pulse', name: 'Pulse Rifle', slot: 'primary', dmg: 22, rpm: 900, mode: 'burst', burst: 3, burstDelay: 0.3, mag: 30, reload: 2.0, spread: 0.02, ads: 0.0022, zoom: 1.5, prec: 1.7, range: 42, recoil: 0.012 },
  scout: { id: 'scout', name: 'Scout Rifle', slot: 'primary', dmg: 40, rpm: 200, mode: 'semi', mag: 16, reload: 2.1, spread: 0.02, ads: 0.0005, zoom: 1.7, prec: 1.8, range: 60, recoil: 0.02 },
  smg: { id: 'smg', name: 'Submachine Gun', slot: 'primary', dmg: 10, rpm: 900, mode: 'auto', mag: 42, reload: 1.6, spread: 0.04, ads: 0.009, zoom: 1.2, prec: 1.5, range: 15, recoil: 0.006, bloom: 0.002 },
  shotgun: { id: 'shotgun', name: 'Shotgun', slot: 'special', dmg: 22, pellets: 10, rpm: 70, mode: 'semi', mag: 5, reserve: 20, brick: 4, reload: 2.2, spread: 0.075, ads: 0.05, zoom: 1.15, prec: 1.4, range: 9, recoil: 0.08, falloff: { close: 4, bonus: 1.15, min: 0.15, span: 1 } },
  sniper: { id: 'sniper', name: 'Sniper Rifle', slot: 'special', dmg: 360, rpm: 50, mode: 'semi', mag: 4, reserve: 16, brick: 4, reload: 2.5, spread: 0.07, ads: 0.0, zoom: 4.5, prec: 2.6, range: 150, recoil: 0.09 },
  fusion: { id: 'fusion', name: 'Fusion Rifle', slot: 'special', dmg: 52, pellets: 7, charge: 0.6, rpm: 80, mode: 'charge', mag: 5, reserve: 20, brick: 5, reload: 2.3, spread: 0.026, ads: 0.011, falloff: { close: 8, bonus: 1.15, min: 0.3, span: 1 }, zoom: 1.3, prec: 1.3, range: 28, recoil: 0.06 },
  linear: { id: 'linear', name: 'Linear Fusion Rifle', slot: 'heavy', dmg: 580, charge: 0.55, rpm: 70, mode: 'charge', mag: 6, reserve: 13, brick: 3, reload: 2.6, spread: 0.045, ads: 0.0, zoom: 2.6, prec: 2.4, range: 120, recoil: 0.07, pierce: true },
  rocket: { id: 'rocket', name: 'Rocket Launcher', slot: 'heavy', dmg: 1210, rpm: 40, mode: 'semi', mag: 1, reserve: 6, brick: 2, reload: 2.4, spread: 0.004, ads: 0.0, zoom: 1.4, prec: 1, range: 200, recoil: 0.08, projectile: { speed: 42, gravity: 0, radius: 6.5, size: 0.18 } },
  mg: { id: 'mg', name: 'Machine Gun', slot: 'heavy', dmg: 41, rpm: 720, mode: 'auto', mag: 70, reserve: 180, brick: 50, reload: 3.0, spread: 0.032, ads: 0.0072, zoom: 1.35, prec: 1.5, range: 45, recoil: 0.012, bloom: 0.002 },
  glauncher: { id: 'glauncher', name: 'Grenade Launcher', slot: 'heavy', dmg: 510, rpm: 110, mode: 'semi', mag: 4, reserve: 11, brick: 3, reload: 2.6, spread: 0.01, ads: 0.0024, zoom: 1.3, prec: 1, range: 120, recoil: 0.05, projectile: { speed: 32, gravity: 16, radius: 4.5, size: 0.12 } },
  // U11 Arsenal II: five new behaviors. Sidearms are a primary; Swords are melee heavies; Glaives and Trace Rifles are special.
  sidearm: { id: 'sidearm', name: 'Sidearm', slot: 'primary', dmg: 26, rpm: 360, mode: 'semi', mag: 15, reload: 1.5, spread: 0.02, ads: 0.0016, zoom: 1.25, prec: 1.7, range: 20, recoil: 0.014 },
  sword: { id: 'sword', name: 'Sword', slot: 'heavy', dmg: 520, rpm: 90, mode: 'sword', mag: 12, reserve: 10, brick: 3, reload: 0.6, spread: 0, ads: 0, zoom: 1, prec: 1.3, range: 4, recoil: 0, sword: { reach: 3.8, cone: 0.55, combo: 2, lunge: 3.5, guard: 0.7, heavy: 2.2 }, noPerks: ['precise', 'opening', 'outlaw', 'killclip', 'tremors', 'jolting', 'rapidhit', 'reconstruction', 'killingwind', 'feeding', 'hotswap', 'envious', 'firefly'] },
  glaive: { id: 'glaive', name: 'Glaive', slot: 'special', dmg: 52, rpm: 300, mode: 'auto', mag: 24, reserve: 28, brick: 6, reload: 1.8, spread: 0.02, ads: 0.004, zoom: 1.25, prec: 1.5, range: 28, recoil: 0.01, glaive: { block: 0.8, drain: 9, gain: 2.5, meleeDmg: 3.2, meleeCd: 1.6, thrust: 6 }, noPerks: ['tremors', 'jolting', 'reconstruction'] },
  trace: { id: 'trace', name: 'Trace Rifle', slot: 'special', dmg: 15, rpm: 1020, mode: 'beam', mag: 140, reserve: 280, brick: 70, reload: 2.0, spread: 0.006, ads: 0.002, zoom: 1.4, prec: 1.4, range: 30, recoil: 0.0025, noPerks: ['tremors', 'jolting', 'rapidhit', 'adrenaline', 'reconstruction', 'envious', 'feeding'] },
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
  // Loot 2.0 (U10): Destiny 2 perks added with the perk columns
  alloymag: { name: 'Alloy Magazine', desc: 'Reloading from an empty magazine is 40% faster.' },
  rapidhit: { name: 'Rapid Hit', desc: 'Precision hits grant stacking reload speed (x5, 6% each) for 2s.' },
  subsistence: { name: 'Subsistence', desc: 'Kills load 20% of the magazine from reserves.' },
  envious: { name: 'Envious Assassin', desc: 'Kills with your other weapons bank rounds for this one. Switching to it loads them from reserves, overfilling up to 2x.' },
  adrenaline: { name: 'Adrenaline Junkie', desc: 'Weapon kills grant stacking +6.5% damage (x5) for 4.5s. A grenade kill grants all five stacks.' },
  oneforall: { name: 'One for All', desc: 'Hitting three different enemies within 3s grants +35% damage for 10s.' },
  baitswitch: { name: 'Bait and Switch', desc: 'Dealing damage with all three weapons within 3s grants this weapon +35% damage for 10s.' },
  tremors: { name: 'Kinetic Tremors', desc: 'Landing repeated hits on one target within 3s sends out 3 shockwaves that damage enemies around it.' },
  repulsor: { name: 'Repulsor Brace', desc: 'Killing a weakened enemy grants an overshield.' },
  jolting: { name: 'Jolting Feedback', desc: 'Every 4th hit on the same target within 2s jolts it.' },
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
  // U11 Arsenal II: Destiny 2 exotics, one signature each
  tesseract: { name: 'Tesseract', desc: 'Sprint, then swing with a full ammo reserve: blink through enemies for heavy arc damage. Swing again within 1.5s to blink back.' },
  exhumation: { name: 'Exhumation', desc: 'A heavy swing with 90% ammo makes you invisible and fires exploding void bolts. Staying invisible for 2.5s boosts damage and makes void bolts weaken.' },
  wail: { name: "Banshee's Wail", desc: 'Hold Block to rev the blade. Revved swings pierce shields and deal 30% more; each hit stacks (5) damage and resistance for heavy swings.' },
  quarrel: { name: 'Hungering Quarrel', desc: 'Fires two tracking bolts per shot. Bolts that land heal you for a share of the damage.' },
  reanimate: { name: 'Violent Reanimation', desc: 'Two kills within 4s grant Devour.' },
  fullstop: { name: 'Full Stop', desc: 'Fires full-auto at a higher rate of fire. Precision hits deal 25% more damage to unshielded targets.' },
  pace: { name: 'Pace Yourself', desc: 'Tap-firing (a gap of 0.35s) cuts recoil and spread by half.' },
  torment: { name: "Primeval's Torment", desc: 'Each grenade blights the area for 6s: enemies take damage over time, and blighted enemies that die leave blight behind.' },
  trinary: { name: 'Trinary Vision', desc: 'Grenades split into three energy waves in a fan when they hit the ground.' },
  fundamentals: { name: 'The Fundamentals', desc: 'Reload with a full magazine to cycle Void, Solar and Arc. 30% more damage when the element matches your subclass.' },
  concurrence: { name: 'Edge of Concurrence', desc: 'Bolts track the nearest enemy and each hit chains lightning to 2 enemies nearby for 50% damage.' },
  action: { name: 'Edge of Action', desc: 'The shield drains half as fast, and blocked damage becomes overshield.' },
  intent: { name: 'Edge of Intent', desc: 'At full energy, a shot plants a Healing Turret that heals you and allies within 6m for 8s.' },
  coldfusion: { name: 'Cold Fusion', desc: 'The longer the beam stays on a target, the harder it hits, up to double damage after 2.5s.' },
  longestwinter: { name: 'Longest Winter', desc: 'At maximum damage the beam sheds an Ionic Trace every 1.5s that restores ability energy.' },
  inferno: { name: 'Prismatic Inferno', desc: 'A heat field grows around the target while you keep firing, burning enemies in it and applying Scorch.' },
  retraction: { name: 'Frame Retraction', desc: 'Kills return a third of the magazine.' },
  harmonic: { name: 'Harmonic Laser', desc: 'Damage cycles through three power levels (100%, 135%, 170%) while the trigger is held.' },
  supercharged: { name: 'Supercharged Battery', desc: 'Picking up an Orb of Power reloads the weapon and holds maximum power for 6s. Sustained fire suppresses.' },
  judgment: { name: 'Judgment', desc: 'Sustained fire wraps the target in a field that weakens and stuns it.' },
  penance: { name: 'Penance', desc: 'A target held in Judgment for 2.5s is struck by a burst of arc damage.' },
};
// Elemental perks roll only on weapons of their element (H3).
export const PERK_ELEMENT = { incandescent: 'solar', voltshot: 'arc', destabilizing: 'void', tremors: 'kinetic', repulsor: 'void', jolting: 'arc' };
// Loot 2.0 (U10): three perk columns, Destiny 2 style. A perk goes by its payoff (docs/DECISIONS.md 2026-10-17).
// Steady Hands and Snapshot Sights no longer roll (no column fits them); old weapons keep them.
export const PERK_COLUMNS = {
  mag: ['extmag', 'alloymag', 'highcal', 'overflow', 'outlaw', 'feeding', 'reconstruction', 'rapidhit', 'subsistence', 'envious', 'hotswap', 'scavenger'],
  damage: ['rampage', 'killclip', 'frenzy', 'surrounded', 'opening', 'precise', 'adrenaline', 'oneforall', 'baitswitch'],
  effect: ['firefly', 'incandescent', 'voltshot', 'destabilizing', 'chainreaction', 'leech', 'demolitionist', 'killingwind', 'tremors', 'repulsor', 'jolting'],
};
export const PERK_COLUMN_NAMES = { mag: 'Magazine or Reload', damage: 'Damage', effect: 'Effect' };
/** The column a perk belongs to, or null (Steady Hands, Snapshot Sights). */
export const perkColumn = (p) => Object.keys(PERK_COLUMNS).find((c) => PERK_COLUMNS[c].includes(p)) || null;
/** Perks grouped by column for the inspect screen (perks from before the columns go under "other"). */
export function perksByColumn(perks = []) {
  const out = Object.fromEntries(Object.keys(PERK_COLUMNS).map((c) => [c, []]));
  out.other = [];
  for (const p of perks) out[perkColumn(p) || 'other'].push(p);
  return out;
}
// Perks that only roll in some ammo slots (the rest roll everywhere).
export const PERK_SLOTS = {
  scavenger: ['special', 'heavy'], overflow: ['special', 'heavy'], chainreaction: ['special', 'heavy'], envious: ['special', 'heavy'],
  precise: ['primary'], reconstruction: ['primary', 'heavy'],
  outlaw: ['primary', 'special'], firefly: ['primary', 'special'], surrounded: ['primary', 'special'], opening: ['primary', 'special'],
  feeding: ['primary', 'special'], destabilizing: ['primary', 'special'], killingwind: ['primary', 'special'],
  rapidhit: ['primary', 'special'], subsistence: ['primary', 'special'], tremors: ['primary', 'special'], jolting: ['primary', 'special'],
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
  // U11 Arsenal II: real Destiny 2 exotics for the new families (perks follow Destinypedia)
  { name: 'Worldline Zero', arch: 'sword', element: 'arc', perks: ['tesseract'], mods: { dmg: 1.05 }, look: { body: 0xcfd6e0, accent: 0x5fd3ff, parts: ['stripes'] }, flavor: 'A sword that has been everywhere you will ever stand.' },
  { name: 'Heartshadow', arch: 'sword', element: 'void', perks: ['exhumation'], look: { body: 0x2a2236, accent: 0xb07cff, parts: ['crystal'] }, flavor: 'Whatever it cuts forgets to bleed.' },
  { name: 'The Lament', arch: 'sword', element: 'solar', perks: ['wail'], mods: { dmg: 0.95, rpm: 1.05 }, look: { body: 0x3a2a24, accent: 0xff8b2b, parts: ['stripes'] }, flavor: 'Wield it long enough and you will hear it sing.' },
  { name: 'Buried Bloodline', arch: 'sidearm', element: 'void', slot: 'special', perks: ['quarrel', 'reanimate'], mods: { dmg: 2.0, pellets: 2, rpm: 0.28, mag: 0.6, reserve: 18, brick: 4, rocketRound: { radius: 1.8, splash: 0.4 } }, look: { body: 0x3a2a4a, accent: 0xb07cff, parts: ['jaw'] }, flavor: 'It hunts, and it feeds.' },
  { name: 'Forerunner', arch: 'sidearm', element: 'kinetic', perks: ['fullstop', 'pace'], mods: { mode: 'auto', rpm: 1.35, dmg: 0.74, range: 1.1 }, look: { body: 0x7a6a4a, accent: 0xffd27a, parts: ['stripes'] }, flavor: 'Made to stop whatever is in the way.' },
  { name: 'Witherhoard', arch: 'glauncher', element: 'kinetic', slot: 'special', perks: ['torment'], mods: { dmg: 0.26, rpm: 0.9, mag: 1.25, reserve: 12, brick: 3, projectile: { speed: 30, gravity: 14, radius: 4.2, size: 0.14 } }, look: { body: 0x4a3a1e, accent: 0xb8c24a, parts: ['spikes'] }, flavor: 'Where it lands, nothing grows back.' },
  { name: 'Dead Messenger', arch: 'glauncher', element: 'void', slot: 'special', perks: ['trinary', 'fundamentals'], mods: { dmg: 0.18, rpm: 0.85, mag: 1, reserve: 10, brick: 3, fan: 3, projectile: { speed: 36, gravity: 9, radius: 2.6, size: 0.1 } }, look: { body: 0x23283a, accent: 0xb07cff, parts: ['skull'] }, flavor: 'Some news is better left undelivered.' },
  { name: 'Edge of Concurrence', arch: 'glaive', element: 'arc', perks: ['concurrence'], look: { body: 0xe8e4da, accent: 0x5fd3ff, parts: ['fins'] }, flavor: 'Many blades, one purpose.' },
  { name: 'Edge of Action', arch: 'glaive', element: 'void', perks: ['action'], mods: { dmg: 0.95 }, look: { body: 0x2c3a4a, accent: 0xb07cff, parts: ['coils'] }, flavor: 'The wall that walks.' },
  { name: 'Edge of Intent', arch: 'glaive', element: 'solar', perks: ['intent'], look: { body: 0xd8b24a, accent: 0xff8b2b, parts: ['sun'] }, flavor: 'Wherever it points, light follows.' },
  { name: 'Coldheart', arch: 'trace', element: 'arc', perks: ['coldfusion', 'longestwinter'], mods: { dmg: 0.85 }, look: { body: 0xcfd6e0, accent: 0x5fd3ff, parts: ['stripes'] }, flavor: 'The cold gets in through the cracks.' },
  { name: 'Prometheus Lens', arch: 'trace', element: 'solar', perks: ['inferno', 'retraction'], mods: { dmg: 0.9 }, look: { body: 0xb8742a, accent: 0xffc04a, parts: ['coils'] }, flavor: 'Steal fire. Keep stealing.' },
  { name: 'Wavesplitter', arch: 'trace', element: 'void', perks: ['harmonic', 'supercharged'], mods: { dmg: 0.85 }, look: { body: 0x2a2236, accent: 0xb07cff, parts: ['fins'] }, flavor: 'Every wave breaks eventually.' },
  { name: 'Divinity', arch: 'trace', element: 'arc', perks: ['judgment', 'penance'], mods: { dmg: 0.9 }, look: { body: 0xf2ecdc, accent: 0xffd27a, parts: ['crystal'] }, flavor: 'The verdict is the light.' },
];
/** Special-ammo weapon types re-slotted as Heavy hit harder and carry less ammo. */
export const HEAVY_VERSION = { dmg: 1.7, reserve: 7, brick: 2 };
// What each exotic armor piece does. Exotic armor belongs to one class, like Destiny 2.
export const EXOTIC_ARMOR_PERKS = {
  // Titan
  'An Insurmountable Skullfort': { id: 'skullfort', name: 'Cranial Spike', desc: 'Kills with your powered melee fully recharge it and restore your health.' },
  Synthoceps: { id: 'synthoceps', name: 'Biotic Enhancements', desc: 'Melee abilities and melee supers deal double damage while 3 or more enemies are within 12m. Your powered melee recharges 25% faster.' },
  'Heart of Inmost Light': { id: 'heart', name: 'Overflowing Light', desc: 'Using an ability empowers your other two for 8s: they recharge 60% faster and deal 30% more damage.' },
  Dunemarchers: { id: 'dunemarchers', name: 'Linear Actuators', desc: 'Sprinting builds static. Your next melee chains lightning into up to 3 enemies.' },
  'Mask of the Quiet One': { id: 'quietone', name: 'Eye for an Eye', desc: 'Taking damage makes your abilities recharge 50% faster for 4s. Void ability kills heal you for 40.' },
  'Ursa Furiosa': { id: 'ursa', name: 'Bear Mother', desc: 'Damage you block while guarding with Sentinel Shield returns super energy when the super ends (up to 50%).' },
  'Hallowfire Heart': { id: 'hallowfire', name: 'Sunheart', desc: 'While your super is fully charged, your abilities recharge 60% faster.' },
  Peacekeepers: { id: 'peacekeepers', name: 'Hip Holsters', desc: 'Submachine guns reload themselves while stowed, and you switch to them twice as fast.' },
  // Hunter
  'Celestial Nighthawk': { id: 'nighthawk', name: 'Hawkeye Hack', desc: 'Golden Gun fires a single shot that deals 5x damage. A kill with it returns 30% super energy.' },
  "Liar's Handshake": { id: 'liars', name: 'Cross Counter', desc: 'Powered melee hits grant Cross Counter for 5s: your next uncharged melee deals double damage and heals you for 40.' },
  'Raiden Flux': { id: 'raiden', name: 'Shocking Blows', desc: 'Each Arc Staff hit extends the super by 0.5s (up to 5s). Quick successive hits deal 10% more damage, stacking to 50%.' },
  'St0mp-EE5': { id: 'stomp', name: 'Hydraulic Boosters', desc: 'Jump 30% higher, move 8% faster, and your dodge recharges 30% faster.' },
  'Graviton Forfeit': { id: 'graviton', name: 'Vanishing Shadow', desc: 'Invisibility lasts 50% longer. While invisible, your melee recharges twice as fast and you regenerate health.' },
  "Young Ahamkara's Spine": { id: 'ahamkara', name: 'Wish-Dragon Teeth', desc: 'Grenade hits return 5% of your melee and class ability energy.' },
  'Lucky Raspberry': { id: 'raspberry', name: 'Sparkling Personality', desc: 'Arc grenades chain lightning into 2 more enemies. An Arc grenade that catches an enemy refunds 30% of its cooldown.' },
  'Orpheus Rig': { id: 'orpheus', name: 'Uncanny Arrows', desc: 'Every enemy caught by a Shadowshot tether returns 5% super energy when the super ends (up to 50%).' },
  // Warlock
  "Nezarec's Sin": { id: 'nezarec', name: 'Abyssal Extractors', desc: 'Void ability kills make all of your abilities recharge twice as fast for 5s.' },
  'Contraverse Hold': { id: 'contraverse', name: 'Chaos Accelerant', desc: 'Void grenades that catch enemies refund 30% of their cooldown. Take 20% less damage for 3s after throwing one.' },
  'Starfire Protocol': { id: 'starfire', name: 'Fusion Harness', desc: 'Your grenade gains a second charge. Solar grenade kills return 20% grenade energy.' },
  'Transversive Steps': { id: 'transversive', name: 'Strategic Relocation', desc: 'Sprint 15% faster. Sprinting for a moment reloads the weapon in your hands.' },
  'Skull of Dire Ahamkara': { id: 'direahamkara', name: 'Dire Promise', desc: 'Nova Bomb kills return 5% super energy each (up to 40%) and make you take 30% less damage for 5s.' },
  Sunbracers: { id: 'sunbracers', name: 'Helium Spirals', desc: 'Solar melee kills give you free Solar grenades for 5s.' },
  "Stormdancer's Brace": { id: 'stormdancer', name: 'Eye of the Storm', desc: 'Stormtrance kills extend the super by 0.5s (up to 5s) and stack 10% more damage, up to 50%.' },
  'Lunafaction Boots': { id: 'lunafaction', name: 'Lunafaction Rift', desc: 'Your rifts also reload the weapons of every Guardian standing inside them, fireteam included.' },
};
/** Exotic armor by class and slot (drops only for its class). The first per slot is the original v1.6 piece. */
export const EXOTIC_ARMOR = {
  vanguard: { helmet: ['An Insurmountable Skullfort', 'Mask of the Quiet One'], arms: ['Synthoceps', 'Ursa Furiosa'], chest: ['Heart of Inmost Light', 'Hallowfire Heart'], legs: ['Dunemarchers', 'Peacekeepers'] },
  stalker: { helmet: ['Celestial Nighthawk', 'Graviton Forfeit'], arms: ["Liar's Handshake", "Young Ahamkara's Spine"], chest: ['Raiden Flux', 'Lucky Raspberry'], legs: ['St0mp-EE5', 'Orpheus Rig'] },
  arcanist: { helmet: ["Nezarec's Sin", 'Skull of Dire Ahamkara'], arms: ['Contraverse Hold', 'Sunbracers'], chest: ['Starfire Protocol', "Stormdancer's Brace"], legs: ['Transversive Steps', 'Lunafaction Boots'] },
};
/** Every exotic armor piece a class can find, with its slot. */
export const exoticArmorFor = (classId) => Object.entries(EXOTIC_ARMOR[classId]).flatMap(([slot, names]) => names.map((name) => ({ name, slot })));

// ---------- Classes ----------
export const CLASSES = {
  vanguard: {
    id: 'vanguard', name: 'Titan', color: '#ff8b2b',
    base: CLASS_BASE.vanguard, jump: 'lift', jumpName: 'Catapult Lift (hold Space in air)',
    subclasses: {
      sunbreaker: {
        name: 'Sunbreaker', element: 'solar', color: '#ff8b2b', tagline: 'Walls, hammers, and fire.',
        defaults: { grenade: 'solar', class: 'barricade', aspects: ['pyre'] },
        abilities: {
          melee: { id: 'hammerthrow', name: 'Throwing Hammer', cd: 10, desc: 'Hurl a solar hammer. Walk over it after it lands to pick it up: your melee recharges instantly and you heal.' },
          super: { id: 'hammers', camera: 'third', name: 'Hammer of Sol', desc: 'For 15s hurl explosive solar hammers and take 70% less damage.' },
        },
      },
      striker: {
        name: 'Striker', element: 'arc', color: '#5fd3ff', tagline: 'Charge in and hit like lightning.',
        defaults: { grenade: 'pulse', class: 'barricade', aspects: ['amplitude'] },
        abilities: {
          melee: { id: 'charge', name: 'Shoulder Charge', cd: 9, desc: 'Sprint-tackle forward, slamming the first enemy you hit.' },
          super: { id: 'fists', camera: 'third', name: 'Fists of Havoc', desc: 'For 14s, each click is a lunging arc slam. Take 70% less damage and move faster.' },
        },
      },
      sentinel: {
        name: 'Sentinel', unlockLevel: 10, element: 'void', color: '#b07cff', tagline: 'A shield for the fireteam. Overshields and suppression.',
        defaults: { grenade: 'suppressor', class: 'barricade', aspects: ['resolve'] },
        abilities: {
          melee: { id: 'shieldthrow', name: 'Shield Throw', cd: 11, desc: 'Throw your shield to ricochet through up to 3 enemies. Grants an overshield.' },
          super: { id: 'sentinel', camera: 'third', name: 'Sentinel Shield', desc: 'For 15s: click to throw a shield that ricochets through enemies and returns, hold right-click to guard, V to bash.' },
        },
      },
    },
  },
  stalker: {
    id: 'stalker', name: 'Hunter', color: '#ffb547',
    base: CLASS_BASE.stalker, jump: 'double', jumpName: 'Triple Jump (press Space in air)',
    subclasses: {
      gunslinger: {
        name: 'Gunslinger', element: 'solar', color: '#ffb547', tagline: 'Dodges, knives, and the Golden Gun.',
        defaults: { grenade: 'swarm', class: 'marksman', aspects: ['chainofwoe'] },
        abilities: {
          melee: { id: 'knife', name: 'Knife Trick', cd: 9, desc: 'Throw a flaming knife. Precision hits deal double damage.' },
          super: { id: 'revolver', camera: 'first', name: 'Golden Gun', desc: 'Six devastating solar shots that burn nearby enemies.' },
        },
      },
      nightstalker: {
        name: 'Nightstalker', element: 'void', color: '#b07cff', tagline: 'Smoke, invisibility, and tethers.',
        defaults: { grenade: 'axion', class: 'marksman', aspects: ['vanishing', 'abyssal'] },
        abilities: {
          melee: { id: 'snare', name: 'Snare Bomb', cd: 10, desc: 'Throw a smoke bomb that sticks, then bursts into a cloud that slows and weakens enemies.' },
          super: { id: 'tether', camera: 'third', name: 'Shadowshot', desc: 'Three void arrows that tether enemies: pulled, slowed, weakened, and burned.' },
        },
      },
      arcstrider: {
        name: 'Arcstrider', unlockLevel: 10, element: 'arc', color: '#5fd3ff', tagline: 'Up close and never still. Dodge, strike, repeat.',
        defaults: { grenade: 'flux', class: 'gambler', aspects: ['lethal', 'crackling'] },
        abilities: {
          melee: { id: 'combo', name: 'Combination Blow', cd: 9, desc: 'Lunging arc strike. A kill fully heals you and refunds half the melee.' },
          super: { id: 'staff', camera: 'third', name: 'Arc Staff', desc: 'For 14s, wield a staff: three-hit combos with a shockwave finisher, dodge freely with C, and take 70% less damage.' },
        },
      },
    },
  },
  arcanist: {
    id: 'arcanist', name: 'Warlock', color: '#b07cff',
    base: CLASS_BASE.arcanist, jump: 'glide', jumpName: 'Burst Glide (press Space in air)',
    subclasses: {
      voidwalker: {
        name: 'Voidwalker', element: 'void', color: '#b07cff', tagline: 'Heal, drain, and annihilate.',
        defaults: { grenade: 'vortex', class: 'rift', aspects: ['bloom'] },
        abilities: {
          melee: { id: 'siphon', name: 'Energy Drain', cd: 11, desc: 'Ranged void strike that restores health and shields.' },
          super: { id: 'nova', camera: 'third', name: 'Nova Bomb', desc: 'Hurl a massive ball of void energy that erases everything it hits, then leaves a void field for 6s that damages, weakens and suppresses enemies inside.' },
        },
      },
      stormcaller: {
        name: 'Stormcaller', unlockLevel: 10, element: 'arc', color: '#5fd3ff', tagline: 'Call down the storm.',
        defaults: { grenade: 'storm', class: 'empower', aspects: ['unlimitedpower'] },
        abilities: {
          melee: { id: 'chainl', name: 'Chain Lightning', cd: 10, desc: 'Ranged arc strike that jumps to three more enemies.' },
          super: { id: 'stormtrance', camera: 'third', name: 'Stormtrance', desc: 'For 12s, hold fire to pour chain lightning from your hands.' },
        },
      },
      dawnblade: { // shown as Sunsinger; the id stays 'dawnblade' so saves and fireteam messages keep working
        name: 'Sunsinger', element: 'solar', color: '#ffb547', tagline: 'Fire that heals. Abilities that never stop.',
        defaults: { grenade: 'solar', class: 'rift', aspects: ['icarus', 'giftsun'] },
        abilities: {
          melee: { id: 'snap', name: 'Incinerator Snap', cd: 9, desc: 'Snap your fingers: three explosions burst down a line ahead and set enemies burning.' },
          super: { id: 'songflame', camera: 'first', name: 'Song of Flame', desc: 'For 10s keep your guns: grenades and melees recharge almost instantly, your weapons deal 30% more damage, and nearby allies are empowered.' },
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
  ['Q', 'Grenade'], ['B', 'Melee'], ['Hold E', 'Revive a teammate'], ['V', 'Charged melee ability'], ['C', 'Class ability'], ['F', 'Super'], ['E', 'Interact'], ['I', 'Inventory (swap weapons)'], ['Esc', 'Pause'],
];
