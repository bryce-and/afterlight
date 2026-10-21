// U13b Hostile Intent II: pure data and rules (no scene), so tools/tests.js can exercise them.
// Minor and major variants, faction profiles, the fireteam table, the hidden ammo meter, and the
// numbers for jetpacks, the Ogre enrage and grenades. Bosses have no tier; minibosses come with dungeons and raids.

// ---- variants ----
// A major is a minor with more health, a little more size and an orange bar. Abilities are shared.
export const TIERS = {
  minor: { hp: 1, dmg: 1, size: 1, bar: '#e8584a', xp: 1, meter: 1 },
  major: { hp: 2, dmg: 1.1, size: 1.12, bar: '#ff9a2e', xp: 2.5, meter: 3 },
};
export const BOSS_BAR = '#f0c040'; // yellow: bosses (and later minibosses)

/** Chance a spawned unit is a major. Captains and heavies are mostly majors at low power; every type gains with power g. */
export function majorChance(typeId, g) {
  if (typeId === 'boss') return 0;
  if (typeId === 'captain' || typeId === 'heavy') return Math.min(0.9, 0.62 + 0.03 * g);
  return Math.min(0.4, 0.04 + 0.04 * g);
}

/** Pick a tier for a spawn; `r` is a 0..1 roll (injectable for tests). */
export function rollTier(typeId, g, r = Math.random()) {
  if (typeId === 'boss') return null;
  return r < majorChance(typeId, g) ? 'major' : 'minor';
}

// ---- fireteam table ----
// Size 1 is the baseline and never changes. Count and boss health are the v2.3 numbers; regular health and damage are new.
export const FIRETEAM_SCALE = {
  1: { count: 1, hp: 1, dmg: 1, boss: 1 },
  2: { count: 1.5, hp: 1.15, dmg: 1.05, boss: 1.6 },
  3: { count: 2, hp: 1.3, dmg: 1.12, boss: 2.2 },
};
export function fireteamScale(n) { return FIRETEAM_SCALE[Math.max(1, Math.min(3, Math.round(n) || 1))]; }

// ---- shields ----
// Destiny 2: shields are elemental, a few units per faction carry one, and breaking one with its own element makes it explode.
export const SHIELD = {
  // weighted element lists per faction and unit type (an element repeated is a likelier roll)
  scrappers: { captain: ['arc', 'arc', 'arc', 'void', 'solar'] },
  hollow: { captain: ['solar', 'solar', 'solar', 'void', 'arc'] },
  legion: { captain: ['solar', 'solar', 'solar', 'arc', 'void'], heavy: ['arc'], heavyHp: 260 },
};
export const SHIELD_BURST = { radius: 5, dmgMul: 0.5, base: 60 };
/** Damage an enemy takes from a neighbour's shield bursting at distance d (none outside the radius). */
export function shieldBurstDamage(maxShield, d) {
  if (d >= SHIELD_BURST.radius) return 0;
  return (SHIELD_BURST.base + maxShield * SHIELD_BURST.dmgMul) * (1 - 0.6 * (d / SHIELD_BURST.radius));
}
export function shieldFor(faction, typeId) {
  const f = SHIELD[faction];
  return f && f[typeId] ? f[typeId] : null;
}

// ---- grenades ----
export const GRENADE = {
  speed: 13, gravity: 14, fuse: 1.1, radius: 4.2, dmg: 34, minRange: 8, maxRange: 26,
  cd: [9, 15],
  // which unit throws, and its grenade color/name per faction (Acolytes and Legionaries are confirmed Destiny 2 grenadiers; Fallen is a best match)
  scrappers: { by: 'grunt', color: 0x5fd3ff, name: 'Arc grenade' },
  hollow: { by: 'grunt', color: 0xb26bff, name: 'Hive grenade' },
  legion: { by: 'grunt', color: 0xff7a2a, name: 'Frag grenade' },
  taken: { by: 'tk_captain', color: 0xdfe8ff, name: 'Darkness orb' }, // U14: the Taken Captain lobs dark orbs
};
export function grenadeThrower(faction, typeId) { return !!GRENADE[faction] && GRENADE[faction].by === typeId; }

// ---- faction profiles ----
// How a faction's units move and fight, as data. All values multiply or replace the per-type numbers in ENEMY_TYPES.
export const FACTION_PROFILES = {
  scrappers: { strafe: 1.5, burstMul: 0.85, coverMul: 1, rushAlone: false, jet: false },    // Fallen: strafing and dodging, short bursts
  hollow:    { strafe: 0.7, burstMul: 1, coverMul: 0.5, rushAlone: true, jet: false },       // Hive: close in, little cover
  legion:    { strafe: 0.5, burstMul: 1.4, coverMul: 1, rushAlone: false, jet: true },       // Cabal: steady advance, long volleys, jetpacks
};

// ---- jetpacks (Cabal Centurions) ----
export const JET = {
  who: ['captain'],
  rise: 0.7, hoverH: 5.5, hover: [5, 10], land: 0.9, crouch: 0.35,
  cd: [12, 20],
  hoverChance: 0.5,        // when the cooldown ends and the unit has a clear view, chance it goes up (otherwise it waits)
  leapMin: 9, leapMax: 15, leapTime: 0.9, leapArc: 3.2,
};

// ---- Ogre enrage (Hive) ----
export const ENRAGE = { below: 0.3, speed: 2.4, meleeMul: 1.5, cd: 1.0, who: ['heavy'], factions: ['hollow'] };
export function enrageApplies(faction, typeId) { return ENRAGE.factions.includes(faction) && ENRAGE.who.includes(typeId); }
export function isEnraged(hp, maxHp, faction, typeId) { return enrageApplies(faction, typeId) && hp > 0 && hp / maxHp < ENRAGE.below; }

// ---- suicide units ----
// Dangerous: the core of the blast takes most of a Guardian's health and shield, but never all of it at once.
export const SUICIDE_BLAST = { frac: 0.8, cap: 0.92, rushMul: 1.35, escortMul: 0.55, escortHold: 9, escortDist: 9, ally: 15 };
/** Core damage: a fraction of the target's health plus shield, scaled by dmgMult, capped below a one-shot. */
export function suicideCore(totalHealth, dmgMult) {
  return Math.min(SUICIDE_BLAST.frac * totalHealth * dmgMult, SUICIDE_BLAST.cap * totalHealth);
}

// ---- boss push and hold ----
export const BOSS_PHASE = {
  hold: [8, 12], push: [6, 9],
  // each health third pushes a little more and holds a little less
  thirds: [{ holdMul: 1, pushMul: 1 }, { holdMul: 0.8, pushMul: 1.2 }, { holdMul: 0.6, pushMul: 1.4 }],
  pushSpeed: 1.5,
};
/** Seconds of the next phase for a boss with `third` thirds of health gone (0, 1 or 2). */
export function bossPhaseTime(phase, third, r = Math.random()) {
  const [a, b] = BOSS_PHASE[phase];
  const t = BOSS_PHASE.thirds[Math.max(0, Math.min(2, third))];
  return (a + (b - a) * r) * (phase === 'hold' ? t.holdMul : t.pushMul);
}

// ---- hidden ammo meter ----
// Kills fill a hidden meter per slot; when it is full the next kill drops a brick of that slot and the meter resets.
// Like Destiny 2, no UI shows it. Brick size scales with how empty the reserve is.
export const AMMO_METER = {
  size: { special: 16, heavy: 42 },
  boss: 14,
  brickMin: 0.6, brickMax: 1.4,
};
/** Meter value of one kill. `tier` is 'minor' | 'major' | null (boss). */
export function killValue(tier, isBoss) {
  if (isBoss) return AMMO_METER.boss;
  return TIERS[tier || 'minor'].meter;
}
/**
 * Add a kill to the meters. Returns which brick to drop ('special', 'heavy' or null) and updates `m`
 * ({ special, heavy }). `fill` multiplies the value (Ammo Finder mods). Only one brick drops per kill:
 * special first, heavy on a later kill.
 */
export function meterKill(m, value, fillS = 1, fillH = 1) {
  m.special += value * fillS;
  m.heavy += value * fillH;
  if (m.special >= AMMO_METER.size.special) { m.special -= AMMO_METER.size.special; return 'special'; }
  if (m.heavy >= AMMO_METER.size.heavy) { m.heavy -= AMMO_METER.size.heavy; return 'heavy'; }
  return null;
}
/** Brick multiplier for a reserve at `frac` of its maximum: bigger when empty, smaller when full. */
export function brickScale(frac) {
  const f = Math.max(0, Math.min(1, frac));
  return AMMO_METER.brickMax - (AMMO_METER.brickMax - AMMO_METER.brickMin) * f;
}

// ---- lobbed grenades ----
/** Launch velocity that lands a grenade at offset (dx, dy, dz) under `gravity`, flight time at least 0.6 s. Returns { vx, vy, vz, t }. */
export function lobVelocity(dx, dy, dz, speed = GRENADE.speed, gravity = GRENADE.gravity) {
  const flat = Math.hypot(dx, dz);
  const t = Math.max(0.6, flat / speed);
  return { vx: dx / t, vy: (dy + 0.5 * gravity * t * t) / t, vz: dz / t, t };
}
