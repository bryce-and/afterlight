import { ABILITY_CD } from './combat.js';
// Subclass registry: grenades (shared per element), class abilities (shared per class),
// aspects (unique to one subclass) and fragments (shared per element), plus the rules for a
// valid loadout. Pure data and functions (no DOM, no Three.js) so the tests can check them.
// Melees and supers stay on each subclass in data.js. Behavior handlers live in player.js
// and abilities.js; they read the ids defined here.
import { CLASSES, classKit } from './data.js';

// kind: the behavior handler in Player.detonateGrenade (Solar and Pulse share one).
export const GRENADES = {
  solar: { name: 'Solar Grenade', element: 'solar', kind: 'pulse', cd: 22, desc: 'Lands and pulses solar fire six times.' },
  swarm: { name: 'Swarm Grenade', element: 'solar', kind: 'swarm', cd: 20, desc: 'Detonates and sends seekers into up to 4 nearby enemies.' },
  healing: { name: 'Healing Grenade', element: 'solar', kind: 'healing', cd: 22, desc: 'Bursts in white light and leaves a healing orb for 10s. Every Guardian who touches it is healed and gains Restoration.' },
  pulse: { name: 'Pulse Grenade', element: 'arc', kind: 'pulse', cd: 20, desc: 'Lands and pulses arc damage six times.' },
  storm: { name: 'Storm Grenade', element: 'arc', kind: 'storm', cd: 22, desc: 'Summons a storm cloud that strikes every enemy below with lightning.' },
  flux: { name: 'Flux Grenade', element: 'arc', kind: 'flux', cd: 20, desc: 'Sticks to the first enemy it hits and detonates, jolting lightning into two more.' },
  vortex: { name: 'Vortex Grenade', element: 'void', kind: 'vortex', cd: 24, desc: 'Creates a void singularity that pulls and shreds enemies.' },
  axion: { name: 'Axion Bolt', element: 'void', kind: 'axion', cd: 20, desc: 'Releases two void bolts that hunt down enemies and weaken them.' },
  suppressor: { name: 'Suppressor Grenade', element: 'void', kind: 'suppressor', cd: 22, desc: 'Explodes and suppresses enemies: they cannot attack for 4s and take extra damage.' },
};

export const CLASS_ABILITIES = {
  vanguard: {
    barricade: { name: 'Towering Barricade', cd: 26, desc: 'Raise a wall that blocks enemy fire for the whole fireteam and reloads your weapons.' },
    rally: { name: 'Rally Barricade', cd: 18, desc: 'Raise a low wall that instantly reloads every weapon. For 6s your reloads are 30% faster.' },
  },
  stalker: {
    marksman: { name: "Marksman's Dodge", cd: 10, desc: 'Dash in your movement direction and instantly reload.' },
    gambler: { name: "Gambler's Dodge", cd: 9, desc: 'Dash in your movement direction and fully recharge your melee.' },
  },
  arcanist: {
    rift: { name: 'Healing Rift', cd: 32, desc: 'Conjure a well that heals everyone inside and speeds reloads.' },
    empower: { name: 'Empowering Rift', cd: 32, desc: 'Conjure a well that gives everyone inside +25% weapon damage.' },
    phoenix: { name: 'Phoenix Dive', cd: 13, sub: 'dawnblade', desc: 'In the air, dive to the ground in a solar burst. On the ground, release the burst where you stand. Always heals you and grants Restoration.' },
  },
};

// slots: fragment slots the aspect opens. unlockLevel: Guardian level beyond the subclass's own.
// cd: cooldown multipliers this aspect applies.
export const ASPECTS = {
  // Titan
  solinvictus: { cls: 'vanguard', sub: 'sunbreaker', name: 'Sol Invictus', slots: 1, desc: 'Solar ability kills leave a Sunspot for 6s. Standing in one heals you and speeds ability recharge by 50%.' },
  roaring: { cls: 'vanguard', sub: 'sunbreaker', name: 'Roaring Flames', slots: 2, desc: 'Solar ability kills grant Roaring Flames: +20% ability damage per stack, up to 3, for 10s.' },
  consecration: { cls: 'vanguard', sub: 'sunbreaker', name: 'Consecration', slots: 1, desc: 'Your powered melee also sends a wave of solar fire along the ground that scorches enemies.' },
  knockout: { cls: 'vanguard', sub: 'striker', name: 'Knockout', slots: 2, desc: 'Breaking a shield or a powered melee kill heals you. For 5s your quick melee hits twice as hard and lunges farther.' },
  juggernaut: { cls: 'vanguard', sub: 'striker', name: 'Juggernaut', slots: 2, desc: 'After sprinting for 1s you raise a frontal shield: take 50% less damage while you keep sprinting.' },
  thunder: { cls: 'vanguard', sub: 'striker', name: 'Touch of Thunder', slots: 1, desc: 'Arc grenades are upgraded: Pulse pulses 8 times, Storm lasts 50% longer, Flux jolts the enemy it sticks to.' },
  demolition: { cls: 'vanguard', sub: 'sentinel', name: 'Controlled Demolition', slots: 2, desc: 'Weakened or suppressed enemies you defeat explode in void energy, and you heal.' },
  bulwark: { cls: 'vanguard', sub: 'sentinel', name: 'Offensive Bulwark', slots: 1, unlockLevel: 13, desc: 'While your overshield is up, grenades recharge 50% faster and powered melees hit 50% harder.' },
  tempered: { cls: 'vanguard', sub: 'sunbreaker', name: 'Tempered Metal', slots: 2, desc: 'Solar ability kills temper your armor for 6s: you move 15% faster and reload 25% faster.' },
  aftershocks: { cls: 'vanguard', sub: 'striker', name: 'Aftershocks', slots: 2, desc: 'Hits with your Arc abilities and super recharge your grenade and melee by 4% (at most every quarter second).' },
  pyre: { cls: 'vanguard', sub: 'sunbreaker', name: 'Explosive Pyre', slots: 1, desc: 'Solar grenade and melee hits scorch enemies for 3s. Scorched enemies you defeat spread scorch to enemies within 4m.' },
  amplitude: { cls: 'vanguard', sub: 'striker', name: 'Amplitude', slots: 2, desc: 'Arc ability kills make you Amplified for 6s: you move faster and reload faster.' },
  resolve: { cls: 'vanguard', sub: 'sentinel', name: "Defender's Resolve", slots: 2, desc: 'Your grenade, melee and class ability grant you an overshield.' },
  unbreakable: { cls: 'vanguard', sub: 'sentinel', name: 'Unbreakable', slots: 1, desc: 'Your grenade becomes a void shield: Q raises it for 2s (90% less damage), then it explodes and weakens enemies around you.' },
  // Hunter
  knockemdown: { cls: 'stalker', sub: 'gunslinger', name: "Knock 'Em Down", slots: 1, desc: 'Golden Gun gains 2 shots, each dealing 15% less damage. Dodging refunds half of your melee.' },
  gunpowder: { cls: 'stalker', sub: 'gunslinger', name: 'Gunpowder Gamble', slots: 2, desc: 'Five kills charge an explosive. While your grenade is recharging, Q throws it instead.' },
  onyourmark: { cls: 'stalker', sub: 'gunslinger', name: 'On Your Mark', slots: 2, desc: 'Dodging grants a stack of On Your Mark: reload 15% faster per stack, up to 3, for 6s.' },
  crackshot: { cls: 'stalker', sub: 'gunslinger', name: 'Crackshot', slots: 1, desc: 'Dodging fires three scorching shots at the nearest enemies in front of you. If all three land, you heal.' },
  prowl: { cls: 'stalker', sub: 'nightstalker', name: 'On the Prowl', slots: 1, desc: 'While invisible you move 15% faster and your melee recharges 50% faster. Your first weapon hit out of invisibility weakens the target.' },
  fasttwitch: { cls: 'stalker', sub: 'arcstrider', name: 'Fast Twitch', slots: 2, desc: 'Powered melee kills fully recharge your dodge and make you Amplified for 4s.' },
  vanishing: { cls: 'stalker', sub: 'nightstalker', name: 'Vanishing Step', slots: 1, cd: { class: 1.2 }, desc: 'Dodging turns you invisible for 4s. Enemies lose track of you.' },
  executioner: { cls: 'stalker', sub: 'nightstalker', name: 'Stylish Executioner', slots: 2, desc: 'Defeating a weakened enemy turns you invisible for 3s and heals you.' },
  trapper: { cls: 'stalker', sub: 'nightstalker', name: "Trapper's Ambush", slots: 1, desc: 'Dodging leaves a cloud of void smoke that slows and weakens enemies.' },
  lethal: { cls: 'stalker', sub: 'arcstrider', name: 'Lethal Current', slots: 1, desc: 'After a dodge, your next powered melee within 4s hits twice as hard and jolts nearby enemies.' },
  flowstate: { cls: 'stalker', sub: 'arcstrider', name: 'Flow State', slots: 2, desc: 'Arc ability kills grant Flow State for 6s: your dodge recharges 50% faster and you reload 25% faster.' },
  ascension: { cls: 'stalker', sub: 'arcstrider', name: 'Ascension', slots: 2, unlockLevel: 16, desc: 'Dodging in the air launches you upward and jolts nearby enemies.' },
  chainofwoe: { cls: 'stalker', sub: 'gunslinger', name: 'Chain of Woe', slots: 2, desc: 'Weapon precision kills give you 15% melee energy and 10% grenade energy.' },
  abyssal: { cls: 'stalker', sub: 'nightstalker', name: 'Abyssal Edge', slots: 1, desc: 'Melee hits weaken enemies for 6s. A melee hit on an enemy that is already weakened spreads weaken to enemies within 5m.' },
  crackling: { cls: 'stalker', sub: 'arcstrider', name: 'Crackling Blade', slots: 1, desc: 'Dodging recharges your melee. Melee kills fully heal you.' },
  // Warlock
  feedvoid: { cls: 'arcanist', sub: 'voidwalker', name: 'Feed the Void', slots: 2, desc: 'Ability kills grant Devour for 8s: every kill fully heals you and extends Devour.' },
  chaos: { cls: 'arcanist', sub: 'voidwalker', name: 'Chaos Accelerant', slots: 1, desc: 'Void grenades are overcharged: Vortex is bigger and lasts longer, Axion fires 3 bolts, Suppressor reaches farther.' },
  angel: { cls: 'arcanist', sub: 'voidwalker', name: 'Angel of Light', slots: 2, desc: 'Aim down sights in the air to hover for up to 3s. Weapon kills while hovering give 10% grenade energy.' },
  childgods: { cls: 'arcanist', sub: 'voidwalker', name: 'Child of the Old Gods', slots: 1, desc: 'Your rift summons a Child of the Old Gods for 8s. It drains the nearest enemy, weakening it and healing you.' },
  electrostatic: { cls: 'arcanist', sub: 'stormcaller', name: 'Electrostatic Mind', slots: 1, desc: 'Arc ability kills release an Ionic Trace that returns to you and recharges every ability by 8% (at most one trace every half second; not from jolt chains).' },
  arcsoul: { cls: 'arcanist', sub: 'stormcaller', name: 'Arc Soul', slots: 1, desc: 'Your rift summons an Arc Soul for 10s that fires lightning at nearby enemies.' },
  surge: { cls: 'arcanist', sub: 'stormcaller', name: 'Lightning Surge', slots: 2, unlockLevel: 19, desc: 'Powered melee while sprinting surges you forward and calls lightning down along your path.' },
  ionicsentry: { cls: 'arcanist', sub: 'stormcaller', name: 'Ionic Sentry', slots: 1, desc: 'Every third Ionic Trace or Arc ability kill deploys an Ionic Sentry at your feet for 8s. It zaps up to 3 enemies and jolts them.' },
  bloom: { cls: 'arcanist', sub: 'voidwalker', name: 'Bloom', slots: 1, desc: 'Void grenade and melee hits make enemies unstable for 5s: they slowly lose health and you gain it. An unstable enemy that dies detonates and weakens enemies nearby.' },
  unlimitedpower: { cls: 'arcanist', sub: 'stormcaller', name: 'Unlimited Power', slots: 1, desc: 'Powered melee hits jolt the target and arc lightning to 2 more enemies nearby.' },
  giftsun: { cls: 'arcanist', sub: 'dawnblade', name: 'Gift of the Sun', slots: 1, cd: { grenade: 0.7 }, desc: 'Solar grenade and melee kills leave a Firesprite. Walk over it for 15% grenade energy (at most 3 at a time). Grenades recharge 30% faster.' },
  touchflame: { cls: 'arcanist', sub: 'dawnblade', name: 'Touch of Flame', slots: 1, desc: 'Solar grenades are upgraded: Solar Grenade pulses 8 times and scorches, Swarm fires 6 seekers, Healing leaves a stronger orb.' },
  heatrises: { cls: 'arcanist', sub: 'dawnblade', name: 'Heat Rises', slots: 2, desc: 'While airborne your grenade and melee recharge 50% faster, and kills in the air grant Restoration.' },
  icarus: { cls: 'arcanist', sub: 'dawnblade', name: 'Icarus Dash', slots: 2, desc: 'In the air, press Shift to dash in your movement direction. 2 charges, each recharging in 6s.' },
  hellion: { cls: 'arcanist', sub: 'dawnblade', name: 'Hellion', slots: 2, desc: 'Your rift also summons a Hellion for 8s: a solar turret that fires scorching bolts at nearby enemies.' },
};

// Tuning for the Light Ascendant aspects and fragments.
export const ASPECT_TUNE = {
  tempered: { t: 6, speed: 1.15, reload: 0.75 },
  aftershocks: { refund: 0.04, gap: 0.25 },
  unbreakable: { t: 2, cut: 0.1, r: 6, dmg: 260 },
  crackshot: { shots: 3, dmg: 90, range: 25, heal: 30 },
  prowl: { speed: 1.15, melee: 1.5 },
  fasttwitch: { amplified: 4 },
  angel: { hover: 3, refund: 0.1 },
  ionicsentry: { every: 3, life: 8, tick: 0.8, dmg: 30, n: 3 },
  hellion: { life: 8, tick: 0.9, dmg: 40 },
  icarus: { charges: 2, cd: 6, t: 0.2, speed: 22 },
  // Former subclass traits (H3)
  pyre: { burnTick: 18, burnTicks: 3, spreadR: 4, spreadDps: 18, spreadT: 3 },
  amplitude: { amplified: 6, speed: 1.1, reload: 1.25 },
  resolve: { over: 25 },
  chainofwoe: { melee: 0.15, grenade: 0.1 },
  abyssal: { weaken: 6, spreadR: 5 },
  crackling: { heal: 1000 },
  bloom: { t: 5, tick: 0.5, dmg: 8, r: 4, weaken: 4 },
  unlimitedpower: { jolt: 4, n: 2, r: 8, dmg: 60 },
  giftsun: { energy: 0.15, life: 10, r: 1.6, max: 3 },
};
export const FRAGMENT_TUNE = {
  searing: 0.1, combustion: { r: 4, dmg: 180 }, benevolence: 1.3, tempering: 2,
  resistance: { n: 3, r: 8, cut: 0.8 }, discharge: 0.3, magnitude: { pulses: 2, storm: 1, flux: 2 },
  remnants: 1.5, obscurity: 3, leeching: 60,
};

// Sunspots (Sol Invictus and Hammer of Sol): enemies inside burn; the caster's copy deals the damage.
export const SUNSPOT = { r: 2.7, life: 6, tick: 0.5, dmg: 22 };
// Healing Grenade orb: lasts `life` seconds; every Guardian can pick it up once (on their own screen).
export const HEAL_ORB = { life: 10, r: 1.4, heal: 40, healBig: 70, restore: 6, restoreBig: 9 };
// Throwing Hammer left on the ground glows brighter, then explodes after `fuse` seconds.
export const HAMMER_FUSE = { fuse: 7, r: 4, dmg: 220 };

export const FRAGMENTS = {
  // Solar: Embers
  torches: { element: 'solar', name: 'Ember of Torches', desc: 'Powered melees make you Radiant for 6s: +15% weapon damage.' },
  ashes: { element: 'solar', name: 'Ember of Ashes', desc: 'Your scorch burns 50% longer.' },
  singeing: { element: 'solar', name: 'Ember of Singeing', desc: 'Solar ability kills take 2s off your class ability cooldown.' },
  empyrean: { element: 'solar', name: 'Ember of Empyrean', desc: 'Solar ability kills extend your Restoration and Radiant by 2s.' },
  searing: { element: 'solar', name: 'Ember of Searing', desc: 'Defeating a scorched enemy gives you 10% melee energy.' },
  combustion: { element: 'solar', name: 'Ember of Combustion', desc: 'Powered melee kills make the target ignite in a solar blast.' },
  benevolence: { element: 'solar', name: 'Ember of Benevolence', desc: 'While you have Restoration, your grenade, melee and class ability recharge 30% faster.' },
  tempering: { element: 'solar', name: 'Ember of Tempering', desc: 'Solar weapon kills grant 2s of Restoration.' },
  // Arc: Sparks
  recharge: { element: 'arc', name: 'Spark of Recharge', desc: 'Below half health, your grenade and melee recharge 50% faster.' },
  shock: { element: 'arc', name: 'Spark of Shock', desc: 'Arc grenades jolt the enemies they hit.' },
  frequency: { element: 'arc', name: 'Spark of Frequency', desc: 'Powered melee hits make you reload 40% faster for 5s.' },
  momentum: { element: 'arc', name: 'Spark of Momentum', desc: 'While sprinting, your grenade and melee recharge 20% faster.' },
  resistance: { element: 'arc', name: 'Spark of Resistance', desc: 'With 3 or more enemies within 8 m, you take 20% less damage.' },
  discharge: { element: 'arc', name: 'Spark of Discharge', desc: 'Arc weapon kills have a 30% chance to release an Ionic Trace that recharges every ability by 5%.' },
  magnitude: { element: 'arc', name: 'Spark of Magnitude', desc: 'Your Arc grenades last longer: Pulse pulses 2 more times, Storm lasts 1s longer, Flux jolts 2 more enemies.' },
  ions: { element: 'arc', name: 'Spark of Ions', unlockLevel: 22, desc: 'Defeating a jolted enemy releases an Ionic Trace that recharges every ability by 5%.' },
  // Void: Echoes
  expulsion: { element: 'void', name: 'Echo of Expulsion', desc: 'Void ability kills make the target explode.' },
  persistence: { element: 'void', name: 'Echo of Persistence', desc: 'Your overshield, invisibility and Devour last 25% longer.' },
  starvation: { element: 'void', name: 'Echo of Starvation', desc: 'Defeating a weakened enemy heals you.' },
  undermining: { element: 'void', name: 'Echo of Undermining', desc: 'Void grenades weaken the enemies they hit for 4s.' },
  instability: { element: 'void', name: 'Echo of Instability', unlockLevel: 25, desc: 'Defeating a weakened enemy grants Volatile Rounds for 6s: your weapon kills explode.' },
  remnants: { element: 'void', name: 'Echo of Remnants', desc: 'Your lingering void effects last 50% longer: Vortex Grenades and Snare Bomb clouds.' },
  obscurity: { element: 'void', name: 'Echo of Obscurity', desc: 'Powered melee kills turn you invisible for 3s.' },
  leeching: { element: 'void', name: 'Echo of Leeching', desc: 'Melee kills heal you for 60.' },
};

// Light Ascendant: the Destiny 2 Light supers each subclass was missing. The subclass's original super
// (abilities.super in data.js) stays the default; these are unlocked on the reward track.
export const SUPERS = {
  maul: { cls: 'vanguard', sub: 'sunbreaker', name: 'Burning Maul', camera: 'third', unlockLevel: 14, desc: 'For 15s wield a burning maul: click to swing, right-click to slam and send a solar tornado rolling forward. Take 70% less damage.' },
  thundercrash: { cls: 'vanguard', sub: 'striker', name: 'Thundercrash', camera: 'third', unlockLevel: 17, desc: 'Launch into the air and fly where you look for up to 3s, then crash down in a massive arc blast. Click to crash early.' },
  wardofdawn: { cls: 'vanguard', sub: 'sentinel', name: 'Ward of Dawn', camera: 'first', unlockLevel: 23, desc: 'Raise a void dome for 14s that destroys enemy shots. Guardians inside gain an overshield and Weapons of Light: +25% weapon damage.' },
  twilight: { cls: 'vanguard', sub: 'sentinel', name: 'Twilight Arsenal', camera: 'third', unlockLevel: 26, desc: 'Throw three void axes that explode and weaken. Each axe stays where it lands for 10s; any Guardian can pick it up and throw it with a click.' },
  bladebarrage: { cls: 'stalker', sub: 'gunslinger', name: 'Blade Barrage', camera: 'first', unlockLevel: 14, desc: 'Launch a volley of explosive solar knives that seek enemies and scorch them.' },
  spectral: { cls: 'stalker', sub: 'nightstalker', name: 'Spectral Blades', camera: 'third', unlockLevel: 17, desc: 'For 12s turn invisible and slash with void blades. Kills keep you hidden. Take 70% less damage.' },
  gathering: { cls: 'stalker', sub: 'arcstrider', name: 'Gathering Storm', camera: 'first', unlockLevel: 23, desc: 'Throw your staff. A second later lightning strikes it in a huge arc blast, and it keeps jolting enemies around it for 5s.' },
  stormsedge: { cls: 'stalker', sub: 'arcstrider', name: "Storm's Edge", camera: 'first', unlockLevel: 26, desc: 'Throw an arc dagger, teleport to it and slash everything around you. Throw up to three times.' },
  well: { cls: 'arcanist', sub: 'dawnblade', name: 'Well of Radiance', camera: 'first', unlockLevel: 14, desc: 'Plant a solar sword that blasts enemies and makes a well for 25s. Guardians inside gain a strong Restoration, take 25% less damage and gain +25% weapon damage. Enemies inside burn.' },
  novawarp: { cls: 'arcanist', sub: 'voidwalker', name: 'Nova Warp', camera: 'third', unlockLevel: 17, desc: 'For 10s: press Space to warp a short distance and release Void seekers that weaken enemies; click to detonate (hold to charge a bigger blast). Take 70% less damage.' },
  chaosreach: { cls: 'arcanist', sub: 'stormcaller', name: 'Chaos Reach', camera: 'third', unlockLevel: 23, desc: 'Channel a long arc beam that pierces and jolts for up to 9s. Press F again to end it early and keep some of your super energy.' },
  daybreak: { cls: 'arcanist', sub: 'dawnblade', name: 'Daybreak', camera: 'third', unlockLevel: 26, desc: 'For 12s soar on solar wings: your jump goes far higher and you hover, sinking slowly. Hurl solar blades that explode and scorch. Take 70% less damage.' },
};

// Class jumps (Light Ascendant). The class's original jump stays the default; `sub` limits a jump to one subclass.
export const JUMPS = {
  vanguard: {
    lift: { name: 'Catapult Lift', desc: 'Hold Space in the air for a strong burst of upward momentum.' },
    highlift: { name: 'High Lift', desc: 'Hold Space in the air to rise higher than any other lift, with less control.' },
    strafelift: { name: 'Strafe Lift', desc: 'Hold Space in the air for a gentler lift with much better air control.' },
  },
  stalker: {
    double: { name: 'Triple Jump', desc: 'Press Space twice in the air: two extra jumps, the second a little lower.' },
    highjump: { name: 'High Jump', desc: 'Press Space in the air for one much higher jump.' },
    strafejump: { name: 'Strafe Jump', desc: 'Press Space in the air for one jump with strong air control.' },
    blink: { name: 'Blink', sub: 'arcstrider', desc: 'Press Space in the air to teleport a short distance in the direction you move.' },
  },
  arcanist: {
    glide: { name: 'Burst Glide', desc: 'Press Space in the air for an upward burst, keep holding to glide fast.' },
    balanced: { name: 'Balanced Glide', desc: 'Press Space in the air and hold to glide with balanced speed and control.' },
    strafeglide: { name: 'Strafe Glide', desc: 'Press Space in the air and hold to glide with the most air control.' },
    blink: { name: 'Blink', sub: 'voidwalker', desc: 'Press Space in the air to teleport a short distance in the direction you move.' },
  },
};
export const JUMP_TUNE = {
  lift: { max: 6.5, fuel: 1.1, air: 2.5 }, highlift: { max: 8.4, fuel: 1.0, air: 1.5 }, strafelift: { max: 5.4, fuel: 1.1, air: 7 },
  highjump: { v: 1.3, air: 2.5 }, strafejump: { v: 1.0, air: 7 },
  glide: { burst: 9.4, speed: 1.35, fuel: 2.8, air: 2.5, steer: 3 }, balanced: { burst: 8.2, speed: 1.15, fuel: 3.2, air: 3, steer: 4.5 }, strafeglide: { burst: 7.2, speed: 1.0, fuel: 3.6, air: 4, steer: 7 },
  blink: { dist: 7, steps: 14, lift: 1.5 },
};

export const ASPECT_SLOTS = 2;
// Combined cooldown speed-ups from aspects and fragments never go past this (Song of Flame is separate).
export const REGEN_CAP = 2;

const subOf = (classId, subId) => CLASSES[classId]?.subclasses[subId];

export const grenadesFor = (element) => Object.keys(GRENADES).filter((id) => GRENADES[id].element === element);
/** Class abilities for a class; one with a `sub` (Phoenix Dive) is only for that subclass. */
export const classAbilitiesFor = (classId, subId) => Object.entries(CLASS_ABILITIES[classId] || {}).filter(([, c]) => !c.sub || c.sub === subId).map(([id]) => id);
export const aspectsFor = (classId, subId) => Object.keys(ASPECTS).filter((id) => ASPECTS[id].cls === classId && ASPECTS[id].sub === subId);
export const fragmentsFor = (element) => Object.keys(FRAGMENTS).filter((id) => FRAGMENTS[id].element === element);
/** Super ids for a subclass: its original super first, then the Light Ascendant ones. */
export const supersFor = (classId, subId) => [subOf(classId, subId).abilities.super.id, ...Object.keys(SUPERS).filter((id) => SUPERS[id].cls === classId && SUPERS[id].sub === subId)];
/** Full super definition (the original lives on the subclass in data.js). */
export function superDef(classId, subId, id) {
  const orig = subOf(classId, subId).abilities.super;
  return id === orig.id ? orig : SUPERS[id] ? { id, ...SUPERS[id] } : null;
}
export const superLevel = (classId, subId, id) => Math.max(subOf(classId, subId)?.unlockLevel ?? 1, SUPERS[id]?.unlockLevel ?? 1);
/** Jump ids a subclass can use. */
export const jumpsFor = (classId, subId) => Object.keys(JUMPS[classId] || {}).filter((id) => !JUMPS[classId][id].sub || JUMPS[classId][id].sub === subId);

/** Guardian level an aspect is usable at (its subclass's unlock level, or its own if higher). */
export function aspectLevel(id) {
  const a = ASPECTS[id];
  return Math.max(subOf(a.cls, a.sub)?.unlockLevel ?? 1, a.unlockLevel ?? 1);
}
export const fragmentLevel = (id) => FRAGMENTS[id].unlockLevel ?? 1;

/** Fragment slots opened by a set of aspects. */
export const fragmentSlots = (aspects) => aspects.reduce((n, id) => n + (ASPECTS[id]?.slots ?? 0), 0);

/** What each subclass equips before the player changes anything (matches v1.2 behavior). */
export function defaultLoadout(classId, subId) {
  const d = subOf(classId, subId).defaults;
  return { super: subOf(classId, subId).abilities.super.id, jump: CLASSES[classId].jump, grenade: d.grenade, class: d.class, aspects: [...(d.aspects || [])], fragments: [] };
}

/**
 * A valid loadout for this subclass at this level: anything unknown, from the wrong element or
 * class, or still locked falls back to the default (or is dropped), and fragments past the
 * open slots are dropped from the end.
 */
export function sanitizeLoadout(classId, subId, lo = {}, level = 1) {
  const sc = subOf(classId, subId);
  if (!sc) throw new Error(`Unknown subclass ${classId}/${subId}`);
  const def = defaultLoadout(classId, subId);
  const out = { ...def };
  if (supersFor(classId, subId).includes(lo.super) && superLevel(classId, subId, lo.super) <= level) out.super = lo.super;
  if (jumpsFor(classId, subId).includes(lo.jump)) out.jump = lo.jump;
  if (GRENADES[lo.grenade]?.element === sc.element) out.grenade = lo.grenade;
  if (classAbilitiesFor(classId, subId).includes(lo.class)) out.class = lo.class;
  if (Array.isArray(lo.aspects)) {
    out.aspects = [...new Set(lo.aspects)].filter((id) => ASPECTS[id]?.cls === classId && ASPECTS[id].sub === subId && aspectLevel(id) <= level).slice(0, ASPECT_SLOTS);
  }
  const slots = fragmentSlots(out.aspects);
  out.fragments = Array.isArray(lo.fragments)
    ? [...new Set(lo.fragments)].filter((id) => FRAGMENTS[id]?.element === sc.element && fragmentLevel(id) <= level).slice(0, slots)
    : [];
  return out;
}

/** Supers, aspects and fragments that become usable exactly at `level` (beyond their subclass unlock), for one class. */
export function buildUnlocksAt(level, classId) {
  const out = [];
  for (const [id, x] of Object.entries(SUPERS)) if (x.cls === classId && superLevel(classId, x.sub, id) === level) out.push({ type: 'super', id, name: x.name, sub: x.sub });
  for (const [id, a] of Object.entries(ASPECTS)) if (a.cls === classId && a.unlockLevel && aspectLevel(id) === level) out.push({ type: 'aspect', id, name: a.name, sub: a.sub });
  for (const [id, f] of Object.entries(FRAGMENTS)) if (f.unlockLevel === level) out.push({ type: 'fragment', id, name: f.name, element: f.element });
  return out;
}

/** Cooldown multipliers from equipped aspects (e.g. Bastion makes the class ability slower). */
export function cooldownMults(aspects) {
  const m = { grenade: 1, melee: 1, class: 1 };
  for (const id of aspects) for (const [k, v] of Object.entries(ASPECTS[id]?.cd || {})) m[k] *= v;
  return m;
}

/** Combined recharge speed from aspect and fragment boosts, capped at REGEN_CAP. */
export const regenMult = (boosts) => Math.min(REGEN_CAP, boosts.reduce((m, b) => m * b, 1));

/** Class + subclass data with the loadout applied: the abilities a Player actually uses. */
export function resolveKit(classId, subId, lo, level) {
  const kit = classKit(classId, subId);
  const L = sanitizeLoadout(classId, kit.subclassId, lo, level);
  const cdm = cooldownMults(L.aspects);
  const g = GRENADES[L.grenade];
  const swap = L.aspects.map((id) => ASPECTS[id].classAs).find(Boolean);
  const c = { id: L.class, ...CLASS_ABILITIES[classId][L.class], ...(swap || {}) };
  return {
    ...kit, loadout: L, aspects: L.aspects, fragments: L.fragments,
    jump: L.jump, jumpName: JUMPS[classId][L.jump].name,
    abilities: {
      ...kit.abilities,
      super: superDef(classId, kit.subclassId, L.super),
      grenade: { id: L.grenade, ...g, cd: Math.round(g.cd * cdm.grenade * ABILITY_CD.grenade) },
      melee: { ...kit.abilities.melee, cd: kit.abilities.melee.cd * cdm.melee * ABILITY_CD.melee },
      class: { ...c, cd: Math.round(CLASS_ABILITIES[classId][L.class].cd * cdm.class * ABILITY_CD.class) },
    },
  };
}
