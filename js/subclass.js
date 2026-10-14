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
  healing: { name: 'Healing Grenade', element: 'solar', kind: 'healing', cd: 22, desc: 'Bursts in solar fire. Every Guardian caught in it is healed and gains Restoration.' },
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
  juggernaut: { cls: 'vanguard', sub: 'striker', name: 'Juggernaut', slots: 1, desc: 'After sprinting for 1s you raise a frontal shield: take 50% less damage while you keep sprinting.' },
  thunder: { cls: 'vanguard', sub: 'striker', name: 'Touch of Thunder', slots: 1, desc: 'Arc grenades are upgraded: Pulse pulses 8 times, Storm lasts 50% longer, Flux jolts the enemy it sticks to.' },
  bastion: { cls: 'vanguard', sub: 'sentinel', name: 'Bastion', slots: 1, cd: { class: 1.3 }, classAs: { id: 'ward', name: 'Bastion Ward', desc: 'Raise a dome for 8s that destroys enemy shots and refreshes the overshield of everyone inside.' }, desc: 'Your Barricade becomes a Bastion Ward: a dome that destroys enemy shots and refreshes overshields inside.' },
  demolition: { cls: 'vanguard', sub: 'sentinel', name: 'Controlled Demolition', slots: 2, desc: 'Weakened or suppressed enemies you defeat explode in void energy, and you heal.' },
  bulwark: { cls: 'vanguard', sub: 'sentinel', name: 'Offensive Bulwark', slots: 1, unlockLevel: 13, desc: 'While your overshield is up, grenades recharge 50% faster and powered melees hit 50% harder.' },
  // Hunter
  knockemdown: { cls: 'stalker', sub: 'gunslinger', name: "Knock 'Em Down", slots: 1, desc: 'Golden Gun gains 2 shots. Dodging refunds half of your melee.' },
  gunpowder: { cls: 'stalker', sub: 'gunslinger', name: 'Gunpowder Gamble', slots: 2, desc: 'Five kills charge an explosive. While your grenade is recharging, Q throws it instead.' },
  onyourmark: { cls: 'stalker', sub: 'gunslinger', name: 'On Your Mark', slots: 1, desc: 'Dodging grants a stack of On Your Mark: reload 15% faster per stack, up to 3, for 6s.' },
  vanishing: { cls: 'stalker', sub: 'nightstalker', name: 'Vanishing Step', slots: 1, cd: { class: 1.2 }, desc: 'Dodging turns you invisible for 4s. Enemies lose track of you.' },
  executioner: { cls: 'stalker', sub: 'nightstalker', name: 'Stylish Executioner', slots: 2, desc: 'Defeating a weakened enemy turns you invisible for 3s and heals you.' },
  trapper: { cls: 'stalker', sub: 'nightstalker', name: "Trapper's Ambush", slots: 1, desc: 'Dodging leaves a cloud of void smoke that slows and weakens enemies.' },
  lethal: { cls: 'stalker', sub: 'arcstrider', name: 'Lethal Current', slots: 1, desc: 'After a dodge, your next powered melee within 4s hits twice as hard and jolts nearby enemies.' },
  flowstate: { cls: 'stalker', sub: 'arcstrider', name: 'Flow State', slots: 2, desc: 'Arc ability kills grant Flow State for 6s: your dodge recharges 50% faster and you reload 25% faster.' },
  ascension: { cls: 'stalker', sub: 'arcstrider', name: 'Ascension', slots: 1, unlockLevel: 16, desc: 'Dodging in the air launches you upward and jolts nearby enemies.' },
  // Warlock
  feedvoid: { cls: 'arcanist', sub: 'voidwalker', name: 'Feed the Void', slots: 2, desc: 'Ability kills grant Devour for 8s: every kill fully heals you and extends Devour.' },
  chaos: { cls: 'arcanist', sub: 'voidwalker', name: 'Chaos Accelerant', slots: 1, desc: 'Void grenades are overcharged: Vortex is bigger and lasts longer, Axion fires 3 bolts, Suppressor reaches farther.' },
  childgods: { cls: 'arcanist', sub: 'voidwalker', name: 'Child of the Old Gods', slots: 1, desc: 'Your rift summons a Child of the Old Gods for 8s. It drains the nearest enemy, weakening it and healing you.' },
  electrostatic: { cls: 'arcanist', sub: 'stormcaller', name: 'Electrostatic Mind', slots: 1, desc: 'Arc ability kills release an Ionic Trace that returns to you and recharges every ability by 8% (at most one trace every half second; not from jolt chains).' },
  arcsoul: { cls: 'arcanist', sub: 'stormcaller', name: 'Arc Soul', slots: 1, desc: 'Your rift summons an Arc Soul for 10s that fires lightning at nearby enemies.' },
  surge: { cls: 'arcanist', sub: 'stormcaller', name: 'Lightning Surge', slots: 2, unlockLevel: 19, desc: 'Powered melee while sprinting surges you forward and calls lightning down along your path.' },
  touchflame: { cls: 'arcanist', sub: 'dawnblade', name: 'Touch of Flame', slots: 1, desc: 'Solar grenades are upgraded: Solar Grenade pulses 8 times and scorches, Swarm fires 6 seekers, Healing reaches farther and heals more.' },
  heatrises: { cls: 'arcanist', sub: 'dawnblade', name: 'Heat Rises', slots: 2, desc: 'While airborne your grenade and melee recharge 50% faster, and kills in the air grant Restoration.' },
  phoenix: { cls: 'arcanist', sub: 'dawnblade', name: 'Phoenix Dive', slots: 1, desc: 'In the air, C dives to the ground in a solar burst on its own 16s timer. Always heals you and grants Restoration.' },
};

export const PHOENIX_DIVE_CD = 16;

export const FRAGMENTS = {
  // Solar: Embers
  torches: { element: 'solar', name: 'Ember of Torches', desc: 'Powered melees make you Radiant for 6s: +15% weapon damage.' },
  ashes: { element: 'solar', name: 'Ember of Ashes', desc: 'Your scorch burns 50% longer.' },
  singeing: { element: 'solar', name: 'Ember of Singeing', desc: 'Solar ability kills take 2s off your class ability cooldown.' },
  empyrean: { element: 'solar', name: 'Ember of Empyrean', desc: 'Solar ability kills extend your Restoration and Radiant by 2s.' },
  // Arc: Sparks
  recharge: { element: 'arc', name: 'Spark of Recharge', desc: 'Below half health, your grenade and melee recharge 50% faster.' },
  shock: { element: 'arc', name: 'Spark of Shock', desc: 'Arc grenades jolt the enemies they hit.' },
  frequency: { element: 'arc', name: 'Spark of Frequency', desc: 'Powered melee hits make you reload 40% faster for 5s.' },
  momentum: { element: 'arc', name: 'Spark of Momentum', desc: 'While sprinting, your grenade and melee recharge 20% faster.' },
  ions: { element: 'arc', name: 'Spark of Ions', unlockLevel: 22, desc: 'Defeating a jolted enemy releases an Ionic Trace that recharges every ability by 5%.' },
  // Void: Echoes
  expulsion: { element: 'void', name: 'Echo of Expulsion', desc: 'Void ability kills make the target explode.' },
  persistence: { element: 'void', name: 'Echo of Persistence', desc: 'Your overshield, invisibility and Devour last 25% longer.' },
  starvation: { element: 'void', name: 'Echo of Starvation', desc: 'Defeating a weakened enemy heals you.' },
  undermining: { element: 'void', name: 'Echo of Undermining', desc: 'Void grenades weaken the enemies they hit for 4s.' },
  instability: { element: 'void', name: 'Echo of Instability', unlockLevel: 25, desc: 'Defeating a weakened enemy grants Volatile Rounds for 6s: your weapon kills explode.' },
};

export const ASPECT_SLOTS = 2;
// Combined cooldown speed-ups from aspects and fragments never go past this (Song of Flame is separate).
export const REGEN_CAP = 2;

const subOf = (classId, subId) => CLASSES[classId]?.subclasses[subId];

export const grenadesFor = (element) => Object.keys(GRENADES).filter((id) => GRENADES[id].element === element);
export const classAbilitiesFor = (classId) => Object.keys(CLASS_ABILITIES[classId] || {});
export const aspectsFor = (classId, subId) => Object.keys(ASPECTS).filter((id) => ASPECTS[id].cls === classId && ASPECTS[id].sub === subId);
export const fragmentsFor = (element) => Object.keys(FRAGMENTS).filter((id) => FRAGMENTS[id].element === element);

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
  return { grenade: d.grenade, class: d.class, aspects: [...(d.aspects || [])], fragments: [] };
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
  if (GRENADES[lo.grenade]?.element === sc.element) out.grenade = lo.grenade;
  if (CLASS_ABILITIES[classId]?.[lo.class]) out.class = lo.class;
  if (Array.isArray(lo.aspects)) {
    out.aspects = [...new Set(lo.aspects)].filter((id) => ASPECTS[id]?.cls === classId && ASPECTS[id].sub === subId && aspectLevel(id) <= level).slice(0, ASPECT_SLOTS);
  }
  const slots = fragmentSlots(out.aspects);
  out.fragments = Array.isArray(lo.fragments)
    ? [...new Set(lo.fragments)].filter((id) => FRAGMENTS[id]?.element === sc.element && fragmentLevel(id) <= level).slice(0, slots)
    : [];
  return out;
}

/** Aspects and fragments that become usable exactly at `level` (beyond their subclass unlock), for one class. */
export function buildUnlocksAt(level, classId) {
  const out = [];
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
    abilities: {
      ...kit.abilities,
      grenade: { id: L.grenade, ...g, cd: Math.round(g.cd * (kit.grenadeCdMult ?? 1) * cdm.grenade) },
      melee: { ...kit.abilities.melee, cd: kit.abilities.melee.cd * cdm.melee },
      class: { ...c, cd: Math.round(CLASS_ABILITIES[classId][L.class].cd * cdm.class) },
    },
  };
}
