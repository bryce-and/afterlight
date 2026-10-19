// Weapon archetypes (Destiny 2 "intrinsic frames"). Each weapon family has a few, and the
// archetype fixes the weapon's stats: every drop of a weapon shoots the same, only perks roll.
// Named legendaries always have the same archetype and element (sourced from Destinypedia,
// see docs/DECISIONS.md). Pure data and functions, shared by loot, the Player, the UI and tests.
import { ARCHETYPES, RARITIES, EXOTIC_WEAPONS, HEAVY_VERSION, PERK_COLUMNS, PERK_ELEMENT, PERK_SLOTS } from './data.js';

// stats: multipliers on the family's base stats. handling: `mult` multiplies the family's
// handling, `set` replaces it (burst size, charge time...), `projectile` multiplies projectile values.
// Damage and rate of fire trade off so each archetype's damage per second stays within ~10%.
export const FRAMES = {
  auto: {
    rapid: { name: 'Rapid-Fire Frame', desc: 'Fast rate of fire, deep magazine, lower damage per round.', stats: { rpm: 1.2, dmg: 0.84, mag: 1.25, range: 0.85, spread: 1.1 }, handling: { mult: { recoil: 0.8 } } },
    adaptive: { name: 'Adaptive Frame', desc: 'Well-rounded: balanced damage and rate of fire.', stats: {} },
    precision: { name: 'Precision Frame', desc: 'Recoil pattern is predictable and kicks straight up. Hits harder per round.', stats: { rpm: 0.75, dmg: 1.3, range: 1.15, spread: 0.85 }, handling: { mult: { recoil: 0.75, prec: 1.06 } } },
    highimpact: { name: 'High-Impact Frame', desc: 'Slow-firing, hard-hitting, with a long reach.', stats: { rpm: 0.6, dmg: 1.62, range: 1.2, mag: 0.85 }, handling: { mult: { recoil: 1.4 } } },
  },
  hand: {
    aggressive: { name: 'Aggressive Frame', desc: 'High damage, heavy recoil.', stats: { rpm: 0.857, dmg: 1.2, range: 1.05, mag: 0.8 }, handling: { mult: { recoil: 1.25 } } },
    adaptive: { name: 'Adaptive Frame', desc: 'Well-rounded: balanced damage and rate of fire.', stats: {} },
    precision: { name: 'Precision Frame', desc: 'Recoil pattern is predictable and kicks straight up. Fires faster.', stats: { rpm: 1.286, dmg: 0.78, range: 0.95, mag: 1.15 }, handling: { mult: { recoil: 0.75 } } },
    lightweight: { name: 'Lightweight Frame', desc: 'Superior mobility while this weapon is held.', stats: { rpm: 1.07, dmg: 0.93, range: 0.95 }, handling: { set: { move: 1.06 } } },
  },
  pulse: {
    rapid: { name: 'Rapid-Fire Frame', desc: 'Short pauses between bursts, lower damage per round.', stats: { dmg: 0.77 }, handling: { set: { burstDelay: 0.2 } } },
    lightweight: { name: 'Lightweight Frame', desc: 'Superior mobility while this weapon is held.', stats: { dmg: 0.9 }, handling: { set: { burstDelay: 0.25, move: 1.06 } } },
    adaptive: { name: 'Adaptive Frame', desc: 'Well-rounded: balanced damage and rate of fire.', stats: {} },
    highimpact: { name: 'High-Impact Frame', desc: 'Slower bursts that hit harder and reach farther.', stats: { dmg: 1.15, range: 1.15 }, handling: { set: { burstDelay: 0.36 } } },
    aggressive: { name: 'Aggressive Frame', desc: 'Fires a four-round burst. Heavy recoil.', stats: { dmg: 1.05 }, handling: { set: { burst: 4, burstDelay: 0.4 }, mult: { recoil: 1.3 } } },
  },
  scout: {
    rapid: { name: 'Rapid-Fire Frame', desc: 'Fast rate of fire, deep magazine, lower damage per round.', stats: { rpm: 1.3, dmg: 0.78, mag: 1.25, range: 0.9 }, handling: { mult: { recoil: 0.85 } } },
    lightweight: { name: 'Lightweight Frame', desc: 'Superior mobility while this weapon is held.', stats: {}, handling: { set: { move: 1.06 } } },
    precision: { name: 'Precision Frame', desc: 'Recoil pattern is predictable and kicks straight up.', stats: { rpm: 0.9, dmg: 1.1 }, handling: { mult: { recoil: 0.8 } } },
    highimpact: { name: 'High-Impact Frame', desc: 'Slow-firing, hard-hitting, with a long reach.', stats: { rpm: 0.75, dmg: 1.33, range: 1.1 }, handling: { mult: { recoil: 1.2 } } },
    aggressive: { name: 'Aggressive Frame', desc: 'High damage, heavy recoil.', stats: { rpm: 0.6, dmg: 1.65, range: 0.9, mag: 0.8 }, handling: { mult: { recoil: 1.4 } } },
  },
  smg: {
    aggressive: { name: 'Aggressive Frame', desc: 'High damage, heavy recoil.', stats: { rpm: 0.833, dmg: 1.2, range: 1.1 }, handling: { mult: { recoil: 1.3 } } },
    adaptive: { name: 'Adaptive Frame', desc: 'Well-rounded: balanced damage and rate of fire.', stats: {} },
    lightweight: { name: 'Lightweight Frame', desc: 'Superior mobility while this weapon is held.', stats: { range: 0.9 }, handling: { set: { move: 1.08 } } },
    precision: { name: 'Precision Frame', desc: 'Recoil pattern is predictable and kicks straight up. Slower, longer reach.', stats: { rpm: 0.667, dmg: 1.48, range: 1.25, spread: 0.8 }, handling: { mult: { recoil: 0.8 } } },
  },
  shotgun: {
    aggressive: { name: 'Aggressive Frame', desc: 'Hard-hitting, wide spread, slow to fire.', stats: { rpm: 0.786, dmg: 1.27, spread: 1.1 } },
    precision: { name: 'Precision Frame', desc: 'Tight, consistent pellet spread.', stats: { rpm: 0.93, dmg: 1.07, spread: 0.7, range: 1.1 } },
    rapid: { name: 'Rapid-Fire Frame', desc: 'Fast rate of fire, deep magazine, lower damage per shot.', stats: { rpm: 2.0, dmg: 0.55, mag: 1.6, range: 0.85 } },
    slug: { name: 'Pinpoint Slug Frame', desc: 'Fires a single slug instead of pellets. Rewards precision hits.', stats: { rpm: 0.93, dmg: 9.5, spread: 0.08, range: 1.4 }, handling: { set: { pellets: 1, slug: true }, mult: { prec: 1.3, ads: 0.05 } } },
  },
  sniper: {
    aggressive: { name: 'Aggressive Frame', desc: 'High damage, heavy recoil.', stats: { rpm: 0.95, dmg: 1.1 }, handling: { mult: { recoil: 1.2 } } },
    adaptive: { name: 'Adaptive Frame', desc: 'Well-rounded: balanced damage and rate of fire.', stats: { rpm: 1.25, dmg: 0.85 } },
    rapid: { name: 'Rapid-Fire Frame', desc: 'Fast rate of fire, deep magazine, lower damage per round.', stats: { rpm: 1.9, dmg: 0.56, mag: 1.5 }, handling: { mult: { recoil: 0.8 } } },
  },
  fusion: {
    rapid: { name: 'Rapid-Fire Frame', desc: 'Charges faster, lower damage per bolt.', stats: { dmg: 0.9 }, handling: { set: { charge: 0.46 } } },
    adaptive: { name: 'Adaptive Frame', desc: 'Well-rounded: balanced damage and charge time.', stats: {} },
    precision: { name: 'Precision Frame', desc: 'Tighter bolt spread, slower charge.', stats: { dmg: 1.12, spread: 0.7, range: 1.15 }, handling: { set: { charge: 0.75 } } },
    highimpact: { name: 'High-Impact Frame', desc: 'Long charge, hard-hitting bolts.', stats: { dmg: 1.22, range: 1.1 }, handling: { set: { charge: 0.9 } } },
  },
  linear: {
    precision: { name: 'Precision Frame', desc: 'Fires a single, precise bolt.', stats: {} },
    aggressive: { name: 'Aggressive Frame', desc: 'Fires a three-bolt burst for each round. Slower charge.', stats: { dmg: 0.38 }, handling: { set: { charge: 0.7, chargeBurst: 3 } } },
  },
  rocket: {
    aggressive: { name: 'Aggressive Frame', desc: 'Larger blast radius, slower rockets.', stats: { dmg: 1.05 }, handling: { projectile: { radius: 1.15, speed: 0.9 } } },
    highimpact: { name: 'High-Impact Frame', desc: 'Heavier warhead, tighter blast, slower to fire.', stats: { dmg: 1.2, rpm: 0.85 }, handling: { projectile: { radius: 0.9 } } },
    adaptive: { name: 'Adaptive Frame', desc: 'Well-rounded: balanced blast radius and velocity.', stats: {} },
    precision: { name: 'Precision Frame', desc: 'Rockets track their target. Slightly less damage.', stats: { dmg: 0.9 }, handling: { set: { tracking: true }, projectile: { speed: 1.1 } } },
  },
  mg: {
    rapid: { name: 'Rapid-Fire Frame', desc: 'Fast rate of fire, deep magazine, lower damage per round.', stats: { rpm: 1.15, dmg: 0.87, mag: 1.3 }, handling: { mult: { recoil: 0.85 } } },
    adaptive: { name: 'Adaptive Frame', desc: 'Well-rounded: balanced damage and rate of fire.', stats: { rpm: 0.75, dmg: 1.33 } },
    highimpact: { name: 'High-Impact Frame', desc: 'Slow-firing, hard-hitting, with a long reach.', stats: { rpm: 0.6, dmg: 1.65, range: 1.15, mag: 0.85 }, handling: { mult: { recoil: 1.3 } } },
  },
  glauncher: {
    adaptive: { name: 'Adaptive Frame', desc: 'Well-rounded: balanced blast radius and velocity.', stats: {} },
    rapid: { name: 'Rapid-Fire Frame', desc: 'Fires faster with a smaller blast and a deeper magazine.', stats: { rpm: 1.25, dmg: 0.8, mag: 1.25 }, handling: { projectile: { radius: 0.9 } } },
    wave: { name: 'Compressed Wave Frame', desc: 'Grenades fly flat and burst into a wave that rolls along the ground, hitting everything in its path.', stats: { dmg: 0.34 }, handling: { set: { wave: 5 }, projectile: { gravity: 0, speed: 1.3 } } },
  },
};

// Named legendaries: family, archetype and element are fixed. `src: 'rpm'` marks archetypes
// inferred from the weapon's rate of fire or charge time because the source didn't name the frame.
export const LEGENDARY_WEAPONS = [
  // Auto Rifles
  { name: 'Gnawing Hunger', arch: 'auto', frame: 'adaptive', element: 'void' },
  { name: 'Age-Old Bond', arch: 'auto', frame: 'highimpact', element: 'void' },
  { name: 'Shadow Price', arch: 'auto', frame: 'precision', element: 'arc' },
  { name: 'Ammit AR2', arch: 'auto', frame: 'precision', element: 'solar' },
  { name: 'The Summoner', arch: 'auto', frame: 'adaptive', element: 'solar', src: 'rpm' },
  { name: 'Ghost Primus', arch: 'auto', frame: 'adaptive', element: 'kinetic' },
  { name: "Rufus's Fury", arch: 'auto', frame: 'rapid', element: 'strand' },
  // Hand Cannons
  { name: 'Fatebringer', arch: 'hand', frame: 'adaptive', element: 'kinetic', src: 'rpm' },
  { name: 'Midnight Coup', arch: 'hand', frame: 'adaptive', element: 'kinetic' },
  { name: 'Igneous Hammer', arch: 'hand', frame: 'aggressive', element: 'solar' },
  { name: 'Not Forgotten', arch: 'hand', frame: 'precision', element: 'solar' },
  { name: "Luna's Howl", arch: 'hand', frame: 'precision', element: 'solar' },
  { name: 'Exalted Truth', arch: 'hand', frame: 'adaptive', element: 'void' },
  // Pulse Rifles
  { name: 'Bygones', arch: 'pulse', frame: 'adaptive', element: 'kinetic' },
  { name: 'Blast Furnace', arch: 'pulse', frame: 'aggressive', element: 'kinetic' },
  { name: 'The Messenger', arch: 'pulse', frame: 'highimpact', element: 'kinetic' },
  { name: 'Inaugural Address', arch: 'pulse', frame: 'adaptive', element: 'void' },
  { name: 'Outlast', arch: 'pulse', frame: 'rapid', element: 'solar' },
  { name: 'Chattering Bone', arch: 'pulse', frame: 'lightweight', element: 'kinetic' },
  { name: 'Stay Frosty', arch: 'pulse', frame: 'lightweight', element: 'stasis' },
  { name: 'Different Times', arch: 'pulse', frame: 'rapid', element: 'strand' },
  // Scout Rifles
  { name: 'Nameless Midnight', arch: 'scout', frame: 'precision', element: 'kinetic' },
  { name: 'Night Watch', arch: 'scout', frame: 'lightweight', element: 'kinetic' },
  { name: 'Vision of Confluence', arch: 'scout', frame: 'precision', element: 'solar' },
  { name: 'Hung Jury SR4', arch: 'scout', frame: 'precision', element: 'kinetic' },
  { name: "Randy's Throwing Knife", arch: 'scout', frame: 'rapid', element: 'kinetic' },
  { name: 'Vouchsafe', arch: 'scout', frame: 'lightweight', element: 'void' },
  { name: 'Perses-D', arch: 'scout', frame: 'highimpact', element: 'stasis' },
  { name: 'Glissando-47', arch: 'scout', frame: 'precision', element: 'strand' },
  { name: 'The Prophet', arch: 'scout', frame: 'aggressive', element: 'stasis' },
  // Submachine Guns
  { name: 'Multimach CCX', arch: 'smg', frame: 'lightweight', element: 'kinetic' },
  { name: 'Funnelweb', arch: 'smg', frame: 'lightweight', element: 'void' },
  { name: "Shayura's Wrath", arch: 'smg', frame: 'precision', element: 'void', src: 'rpm' },
  { name: 'IKELOS_SMG_v1.0.3', arch: 'smg', frame: 'aggressive', element: 'arc', src: 'rpm' },
  { name: 'The Title', arch: 'smg', frame: 'aggressive', element: 'void' },
  // Shotguns
  { name: "Felwinter's Lie", arch: 'shotgun', frame: 'aggressive', element: 'solar', src: 'rpm' },
  { name: 'The Comedian', arch: 'shotgun', frame: 'aggressive', element: 'void', src: 'rpm' },
  { name: "Mindbender's Ambition", arch: 'shotgun', frame: 'aggressive', element: 'solar' },
  { name: 'Matador 64', arch: 'shotgun', frame: 'precision', element: 'arc' },
  { name: 'Heritage', arch: 'shotgun', frame: 'slug', element: 'kinetic' },
  // Sniper Rifles
  { name: 'Beloved', arch: 'sniper', frame: 'adaptive', element: 'solar' },
  { name: '1000 Yard Stare', arch: 'sniper', frame: 'adaptive', element: 'void' },
  { name: 'Eye of Sol', arch: 'sniper', frame: 'adaptive', element: 'kinetic' },
  { name: "Praedyth's Revenge", arch: 'sniper', frame: 'rapid', element: 'kinetic', src: 'rpm' },
  { name: 'Twilight Oath', arch: 'sniper', frame: 'rapid', element: 'solar' },
  // Fusion Rifles
  { name: 'Main Ingredient', arch: 'fusion', frame: 'precision', element: 'arc', src: 'rpm' },
  { name: 'Plug One.1', arch: 'fusion', frame: 'precision', element: 'arc' },
  { name: 'Glacioclasm', arch: 'fusion', frame: 'highimpact', element: 'void' },
  { name: 'Loaded Question', arch: 'fusion', frame: 'highimpact', element: 'arc' },
  { name: 'Deliverance', arch: 'fusion', frame: 'precision', element: 'stasis' },
  // Linear Fusion Rifles
  { name: 'Taipan-4fr', arch: 'linear', frame: 'precision', element: 'void' },
  { name: 'Stormchaser', arch: 'linear', frame: 'aggressive', element: 'arc' },
  { name: "Briar's Contempt", arch: 'linear', frame: 'aggressive', element: 'solar' },
  { name: 'Cataclysmic', arch: 'linear', frame: 'precision', element: 'solar' },
  { name: "Reed's Regret", arch: 'linear', frame: 'precision', element: 'stasis' },
  { name: 'Fire and Forget', arch: 'linear', frame: 'aggressive', element: 'stasis' },
  // Rocket Launchers
  { name: 'Hezen Vengeance', arch: 'rocket', frame: 'aggressive', element: 'solar' },
  { name: "Tomorrow's Answer", arch: 'rocket', frame: 'highimpact', element: 'void' },
  { name: 'Bad Omens', arch: 'rocket', frame: 'aggressive', element: 'void' },
  { name: 'Apex Predator', arch: 'rocket', frame: 'adaptive', element: 'solar' },
  // Machine Guns
  { name: 'Hammerhead', arch: 'mg', frame: 'adaptive', element: 'void' },
  { name: 'Corrective Measure', arch: 'mg', frame: 'adaptive', element: 'void' },
  { name: 'Commemoration', arch: 'mg', frame: 'adaptive', element: 'void' },
  { name: 'Fixed Odds', arch: 'mg', frame: 'highimpact', element: 'solar' },
  { name: "Qullim's Terminus", arch: 'mg', frame: 'highimpact', element: 'stasis' },
  { name: "Planck's Stride", arch: 'mg', frame: 'rapid', element: 'arc' },
  { name: 'Recurrent Impact', arch: 'mg', frame: 'rapid', element: 'stasis' },
  { name: 'Retrofit Escapade', arch: 'mg', frame: 'rapid', element: 'void' },
  { name: 'Circular Logic', arch: 'mg', frame: 'adaptive', element: 'strand' },
  // Grenade Launchers
  { name: 'Wendigo GL3', arch: 'glauncher', frame: 'adaptive', element: 'arc' },
  { name: 'Tarnation', arch: 'glauncher', frame: 'rapid', element: 'arc' },
  { name: 'Edge Transit', arch: 'glauncher', frame: 'adaptive', element: 'void' },
  { name: 'Regnant', arch: 'glauncher', frame: 'adaptive', element: 'void' },
  { name: 'Hullabaloo', arch: 'glauncher', frame: 'wave', element: 'arc' },
];

// Loot 2.0 (U10): named weapons below legendary. Like legendaries, a name fixes the archetype and element.
// Destiny 2 world-drop names where they exist (checked on godroll.tv's Red War list, 2026-10-19); `orig: true`
// marks an original name where Destiny ran out. Frames Afterlight lacks map to the nearest one it has.
export const NAMED_WEAPONS = [
  // Auto Rifles
  { name: 'Khvostov 7G-02', rarity: 'common', arch: 'auto', frame: 'adaptive', element: 'kinetic' },
  { name: 'Cydonia-AR1', rarity: 'uncommon', arch: 'auto', frame: 'adaptive', element: 'kinetic' },
  { name: 'Vesper AR3', rarity: 'uncommon', arch: 'auto', frame: 'rapid', element: 'solar', orig: true },
  { name: 'Cuboid ARu', rarity: 'rare', arch: 'auto', frame: 'precision', element: 'kinetic' },
  { name: 'Halcyon ARv', rarity: 'rare', arch: 'auto', frame: 'highimpact', element: 'arc', orig: true },
  // Hand Cannons
  { name: 'Ostrom HC1', rarity: 'common', arch: 'hand', frame: 'adaptive', element: 'kinetic', orig: true },
  { name: 'Brevin HC4', rarity: 'uncommon', arch: 'hand', frame: 'precision', element: 'solar', orig: true },
  { name: 'Tallis-C', rarity: 'uncommon', arch: 'hand', frame: 'lightweight', element: 'void', orig: true },
  { name: 'Allegro-34', rarity: 'rare', arch: 'hand', frame: 'adaptive', element: 'solar' },
  { name: 'Azimuth DSu', rarity: 'rare', arch: 'hand', frame: 'aggressive', element: 'kinetic' },
  { name: 'Ballyhoo Mk.27', rarity: 'rare', arch: 'hand', frame: 'adaptive', element: 'kinetic' },
  { name: 'Guseva-C', rarity: 'rare', arch: 'hand', frame: 'aggressive', element: 'kinetic' },
  // Pulse Rifles
  { name: 'Lumen PR1', rarity: 'common', arch: 'pulse', frame: 'adaptive', element: 'kinetic', orig: true },
  { name: 'Cadenza-11', rarity: 'uncommon', arch: 'pulse', frame: 'adaptive', element: 'solar' },
  { name: 'Sonata-9', rarity: 'uncommon', arch: 'pulse', frame: 'rapid', element: 'arc', orig: true },
  { name: 'Agrona PR2', rarity: 'rare', arch: 'pulse', frame: 'lightweight', element: 'solar' },
  { name: 'Bayesian MSu', rarity: 'rare', arch: 'pulse', frame: 'adaptive', element: 'kinetic' },
  { name: 'Encore-25', rarity: 'rare', arch: 'pulse', frame: 'adaptive', element: 'solar' },
  // Scout Rifles
  { name: 'Pathfinder SR1', rarity: 'common', arch: 'scout', frame: 'lightweight', element: 'kinetic', orig: true },
  { name: 'Fare-Thee-Well', rarity: 'uncommon', arch: 'scout', frame: 'lightweight', element: 'kinetic' },
  { name: 'Meridian SRt', rarity: 'uncommon', arch: 'scout', frame: 'precision', element: 'arc', orig: true },
  { name: 'Armillary PSu', rarity: 'rare', arch: 'scout', frame: 'precision', element: 'kinetic' },
  { name: 'Black Tiger-2sr', rarity: 'rare', arch: 'scout', frame: 'rapid', element: 'arc' },
  // Submachine Guns
  { name: 'Etude-12', rarity: 'common', arch: 'smg', frame: 'adaptive', element: 'void' },
  { name: 'Daystar SMG2', rarity: 'uncommon', arch: 'smg', frame: 'lightweight', element: 'solar' },
  { name: 'Forte-15', rarity: 'uncommon', arch: 'smg', frame: 'adaptive', element: 'void' },
  { name: 'Furina-2mg', rarity: 'rare', arch: 'smg', frame: 'lightweight', element: 'solar' },
  { name: 'Harmony-21', rarity: 'rare', arch: 'smg', frame: 'adaptive', element: 'void' },
  // Shotguns
  { name: 'Häkke SG-3', rarity: 'common', arch: 'shotgun', frame: 'aggressive', element: 'arc', orig: true },
  { name: 'Ded Nemoris II', rarity: 'uncommon', arch: 'shotgun', frame: 'aggressive', element: 'arc' },
  { name: 'Hand in Hand', rarity: 'uncommon', arch: 'shotgun', frame: 'precision', element: 'solar' },
  { name: 'Botheration Mk.28', rarity: 'rare', arch: 'shotgun', frame: 'aggressive', element: 'solar' },
  { name: 'Fussed Dark Mk.21', rarity: 'rare', arch: 'shotgun', frame: 'precision', element: 'arc' },
  // Sniper Rifles
  { name: 'Dead Zone Rifle', rarity: 'common', arch: 'sniper', frame: 'adaptive', element: 'void' },
  { name: 'Longwatch SN2', rarity: 'uncommon', arch: 'sniper', frame: 'rapid', element: 'solar', orig: true },
  { name: 'Steadfast-LR1', rarity: 'uncommon', arch: 'sniper', frame: 'aggressive', element: 'arc', orig: true },
  { name: 'Aachen-LR2', rarity: 'rare', arch: 'sniper', frame: 'adaptive', element: 'void' },
  { name: 'Damietta-LR2', rarity: 'rare', arch: 'sniper', frame: 'aggressive', element: 'arc' },
  // Fusion Rifles
  { name: 'Corona FR1', rarity: 'common', arch: 'fusion', frame: 'adaptive', element: 'solar', orig: true },
  { name: 'Equinox Tsu', rarity: 'uncommon', arch: 'fusion', frame: 'precision', element: 'solar' },
  { name: 'Solstice Fsu', rarity: 'uncommon', arch: 'fusion', frame: 'rapid', element: 'arc', orig: true },
  { name: 'Parallax Fu', rarity: 'rare', arch: 'fusion', frame: 'highimpact', element: 'void', orig: true },
  { name: 'Zenith FR4', rarity: 'rare', arch: 'fusion', frame: 'adaptive', element: 'arc', orig: true },
  // Linear Fusion Rifles
  { name: 'Lancet LFR1', rarity: 'common', arch: 'linear', frame: 'precision', element: 'void', orig: true },
  { name: 'Spindle LFR2', rarity: 'uncommon', arch: 'linear', frame: 'precision', element: 'solar', orig: true },
  { name: 'Needle-6', rarity: 'uncommon', arch: 'linear', frame: 'aggressive', element: 'arc', orig: true },
  { name: 'Filament LFR4', rarity: 'rare', arch: 'linear', frame: 'aggressive', element: 'void', orig: true },
  { name: 'Tracer Line-7', rarity: 'rare', arch: 'linear', frame: 'precision', element: 'arc', orig: true },
  // Rocket Launchers
  { name: 'Tumbril RL1', rarity: 'common', arch: 'rocket', frame: 'adaptive', element: 'solar', orig: true },
  { name: 'Butler RS/2', rarity: 'uncommon', arch: 'rocket', frame: 'highimpact', element: 'arc' },
  { name: 'Porter RS/1', rarity: 'uncommon', arch: 'rocket', frame: 'adaptive', element: 'void', orig: true },
  { name: 'Cup-Bearer SA/2', rarity: 'rare', arch: 'rocket', frame: 'adaptive', element: 'void' },
  { name: 'Steward SA/3', rarity: 'rare', arch: 'rocket', frame: 'precision', element: 'solar', orig: true },
  // Machine Guns
  { name: 'Ramrod MG1', rarity: 'common', arch: 'mg', frame: 'adaptive', element: 'solar', orig: true },
  { name: 'Rampart MG2', rarity: 'uncommon', arch: 'mg', frame: 'rapid', element: 'arc', orig: true },
  { name: 'Palisade MG3', rarity: 'uncommon', arch: 'mg', frame: 'adaptive', element: 'void', orig: true },
  { name: 'Parapet MG4', rarity: 'rare', arch: 'mg', frame: 'highimpact', element: 'solar', orig: true },
  { name: 'Embrasure MG5', rarity: 'rare', arch: 'mg', frame: 'rapid', element: 'arc', orig: true },
  // Grenade Launchers
  { name: 'Mortar GL1', rarity: 'common', arch: 'glauncher', frame: 'adaptive', element: 'solar', orig: true },
  { name: 'Gareth-C', rarity: 'uncommon', arch: 'glauncher', frame: 'rapid', element: 'void' },
  { name: 'Hadrian-A', rarity: 'uncommon', arch: 'glauncher', frame: 'rapid', element: 'arc' },
  { name: 'Harsh Language', rarity: 'rare', arch: 'glauncher', frame: 'adaptive', element: 'arc' },
  { name: 'Salvo GL4', rarity: 'rare', arch: 'glauncher', frame: 'adaptive', element: 'solar', orig: true },
];

/** Named weapons of an archetype at a rarity below exotic (legendaries included). */
export const namedFor = (arch, rarity) => (rarity === 'legendary' ? legendariesFor(arch) : NAMED_WEAPONS.filter((n) => n.arch === arch && n.rarity === rarity));
/** The named entry behind an item (any rarity below exotic), or null. */
export const findNamed = (name, arch) => findLegendary(name, arch) || NAMED_WEAPONS.find((n) => n.name === name && n.arch === arch) || null;

/** Every perk of a column that can roll on this archetype and element. */
export function eligiblePerks(col, arch, element) {
  const A = ARCHETYPES[arch];
  return PERK_COLUMNS[col].filter((p) => (!PERK_SLOTS[p] || PERK_SLOTS[p].includes(A.slot)) && (!PERK_ELEMENT[p] || PERK_ELEMENT[p] === element) && !(p === 'extmag' && A.mag === 1));
}

export const POOL_PER_COLUMN = 3;
/**
 * A named weapon's 9-perk pool: 3 per column, the same for every drop of that weapon. An entry's own
 * `pool` ({ mag, damage, effect }) wins; otherwise the pool is picked from the eligible perks, seeded by the name.
 */
export function perkPoolFor(named) {
  if (named.pool) return named.pool;
  let h = 2166136261;
  for (const ch of named.name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => { h = (h + 0x6d2b79f5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = {};
  for (const col of Object.keys(PERK_COLUMNS)) {
    const list = eligiblePerks(col, named.arch, named.element);
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    out[col] = list.slice(0, POOL_PER_COLUMN);
  }
  return out;
}

/** The perks a drop rolls from its pool: uncommon one Magazine or Reload perk, rare adds a Damage or Effect perk, legendary all three. */
export function rollPerks(pool, rarity, rnd = Math.random) {
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  if (rarity === 'uncommon') return [pick(pool.mag)];
  if (rarity === 'rare') return [pick(pool.mag), pick(rnd() < 0.5 ? pool.damage : pool.effect)];
  if (rarity === 'legendary') return [pick(pool.mag), pick(pool.damage), pick(pool.effect)];
  return [];
}

export const framesFor = (arch) => Object.keys(FRAMES[arch] || {});
export const legendariesFor = (arch) => LEGENDARY_WEAPONS.filter((l) => l.arch === arch);
export const findLegendary = (name, arch) => LEGENDARY_WEAPONS.find((l) => l.name === name && l.arch === arch) || null;
export const frameDef = (item) => (item.frame ? FRAMES[item.arch]?.[item.frame] ?? null : null);

/** A stable archetype for an item that has none yet (older saves): from its name if it's a named legendary, else from its id. */
export function frameFor(item) {
  const named = findLegendary(item.name, item.arch);
  if (named) return named.frame;
  const ids = framesFor(item.arch);
  let h = 0;
  for (const ch of String(item.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ids[h % ids.length];
}

const MOD_REPLACE = ['mode', 'burst', 'burstDelay', 'pellets', 'charge'];

/** The weapon's stats: family base x archetype x rarity (exotics: x their own mods). No randomness. */
export function weaponStats(item) {
  const A = ARCHETYPES[item.arch];
  const rar = RARITIES.find((r) => r.id === item.rarity) || RARITIES[0];
  const f = { dmg: 1, rpm: 1, mag: 1, reload: 1, spread: 1, range: 1 };
  const fr = frameDef(item);
  if (fr) Object.assign(f, fr.stats);
  if (item.rarity === 'exotic') {
    const tpl = EXOTIC_WEAPONS.find((e) => e.name === item.name);
    for (const [k, v] of Object.entries(tpl?.mods || {})) if (!MOD_REPLACE.includes(k) && k in f) f[k] *= v;
  }
  const stats = {
    dmg: +(A.dmg * rar.mult * f.dmg).toFixed(1),
    rpm: Math.max(1, Math.round(A.rpm * f.rpm)),
    mag: A.mag === 1 ? 1 : Math.max(1, Math.round(A.mag * f.mag)),
    reload: +(A.reload * f.reload).toFixed(2),
    spread: +(A.spread * f.spread).toFixed(4),
    range: Math.round(A.range * f.range),
  };
  if (item.slot && item.slot !== A.slot) stats.dmg = +(stats.dmg * HEAVY_VERSION.dmg).toFixed(1);
  return stats;
}

/** The handling the Player fires with: family archetype, then the frame, then exotic overrides. */
export function weaponHandling(item) {
  const A = { ...ARCHETYPES[item.arch] };
  const h = frameDef(item)?.handling;
  if (h) {
    for (const [k, v] of Object.entries(h.mult || {})) A[k] = (A[k] ?? 0) * v;
    Object.assign(A, h.set || {});
    if (h.projectile && A.projectile) {
      A.projectile = { ...A.projectile };
      for (const [k, v] of Object.entries(h.projectile)) A.projectile[k] = k === 'gravity' ? v : A.projectile[k] * v;
    }
  }
  return Object.assign(A, item.mods || {});
}
