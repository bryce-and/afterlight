// Combat rules and tuning that don't need Three.js, so tools/tests.js can check them directly.

// ---------- super energy ----------
export const SUPER_PASSIVE = 0.5; // % per second (v1.1: 0.75)
export const SUPER_HANDSON = 1.5; // % per ability/melee kill per Hands-On piece (v1.3: 3, v1.1: 4)
export const SUPER_DYNAMO = 0.08; // passive super gain per Dynamo piece (v1.3: 0.12)
/** Super energy for one kill: 2 to 6%. (v1.1: 3 to 10%.) */
export function superKillGain(source, crit, typeId) {
  const base = source === 'ability' || source === 'melee' ? 3 : 2;
  return base + (crit ? 1 : 0) + (typeId === 'heavy' ? 2 : typeId === 'captain' ? 1 : 0);
}
// Ionic Trace: share of every ability cooldown refunded per trace, and the minimum gap between
// traces. Jolt-chain kills don't send one. (v1.3: Electrostatic Mind 0.15, Spark of Ions 0.1, no gap.)
export const IONIC = { electrostatic: 0.08, ions: 0.05, gap: 0.5 };
// Celestial Nighthawk: the first super hit, once. (v1.3: Golden Gun 6x, other supers 4x.)
export const NIGHTHAWK = { goldenGun: 4, other: 2.5 };
// super damage multiplier (v1.1: 2.2)
export const SUPER_POWER = 2.0;

// ---------- Song of Flame ----------
export const SONG = { duration: 10, abilityRegen: 4 }; // v1.1: 12 s, 8x

// ---------- weapon damage ----------
// Enemy health grows 10% per mission tier. Weapons keep 75% of that pace so late missions
// still feel tougher without primaries falling behind (abilities and supers keep full pace).
export const WEAPON_TIER_STEP = 0.075;
export const weaponTierMult = (g) => 1 + Math.max(0, g) * WEAPON_TIER_STEP;
export const PRIMARY_BOOST = 1.1;
export const ABILITY_POWER = 1.3; // v1.1: 1.4

// ---------- aim ----------
/** Cone half-angle for a shot. hip/ads from the weapon; adsT 0..1. */
export function spreadFor({ hip, ads, adsT, moving, air, steady, bloom }) {
  let s = hip + (ads - hip) * adsT;
  if (moving) s *= 1.3 + (1 - 1.3) * adsT; // aimed: moving no longer widens the cone
  if (air) s *= 1.8;
  if (steady) s *= 0.65;
  return s + bloom * (1 - adsT * 0.8);
}

// ---------- multi-target abilities ----------
/** The n targets after the primary: candidates sorted nearest first, primary excluded. */
export const chainTargets = (primary, candidates, n) => candidates.filter((e) => e !== primary).slice(0, n);
export const STORMTRANCE_CHAIN = 3; // primary + 3 = up to 4 enemies
export const GOLDEN_GUN_SPLASH = 2;
export const STORM_GRENADE = { tick: 0.3, dmg: 30, r: 5.5 }; // v1.1: 40 to one random target per tick

// ---------- stagger ----------
// A hit worth `frac` of max health (lower for precision hits) makes a non-boss enemy flinch.
export const STAGGER = {
  grunt: { frac: 0.12, crit: 0.08 },
  rusher: { frac: 0.12, crit: 0.08 },
  captain: { frac: 0.2, crit: 0.14 },
  heavy: { frac: 0.3, crit: 0.2 },
  min: 0.15, max: 0.35, cooldown: 0.9,
};
/** Flinch duration in seconds for a hit, or 0. ready: the enemy's stagger cooldown has run out. */
export function staggerFor(typeId, dealt, maxHp, crit, ready) {
  const r = STAGGER[typeId];
  if (!r || !ready || !(maxHp > 0)) return 0;
  const need = crit ? r.crit : r.frac;
  const f = dealt / maxHp;
  if (f < need) return 0;
  return Math.min(STAGGER.max, STAGGER.min + (STAGGER.max - STAGGER.min) * Math.min(1, (f - need) / need));
}

// ---------- damage numbers ----------
/** Screen offset (px) of a damage number `age` seconds old: out to one side, easing down. */
export function dmgDrift(side, age) {
  const k = 1 - Math.pow(1 - Math.min(1, age / 0.8), 3);
  return { x: side * (14 + 46 * k), y: -10 + 22 * k * k };
}

// Jolt (Arc debuff): a hit on a jolted enemy arcs dmg into it and up to n enemies within r metres.
// One discharge per enemy every cd seconds.
export const JOLT = { dmg: 45, n: 3, r: 8, cd: 0.6 };

// ---------- zones and waves ----------
/**
 * One check of a combat zone. The next wave comes in when 2 or fewer are left; the zone is clear
 * only when every wave has spawned and nothing is alive. Spawning a wave never clears the zone in
 * the same check (v1.3 counted before the spawn and could clear with the new wave standing).
 */
export function waveStep(alive, waveIdx, waveCount, isBoss = false) {
  const spawn = !isBoss && waveIdx < waveCount && alive <= 2;
  return { spawn, cleared: !spawn && waveIdx >= waveCount && alive === 0 };
}

// ---------- drops ----------
// Engram chance per kill (v1.3: grunt 0.06, rusher 0.05, captain 0.3, heavy 0.45). Bosses always drop one.
export const ENGRAM_CHANCE = { grunt: 0.02, rusher: 0.02, captain: 0.05, heavy: 0.08, boss: 1 };

// ---------- thrown hammer ----------
/**
 * Height a dropped hammer rests at: the highest collider top under (x, z) that is at or below
 * the impact height (plus a small step), else the ground. Boxes are { min, max } with x/y/z.
 */
export function restHeight(x, z, y, boxes, step = 0.3) {
  let top = 0;
  for (const c of boxes) {
    if (x < c.min.x || x > c.max.x || z < c.min.z || z > c.max.z) continue;
    if (c.max.y <= y + step && c.max.y > top) top = c.max.y;
  }
  return top;
}

// ---------- HUD ----------
export const HUD_SCALE = { min: 0.7, max: 2, step: 0.05 }; // v1.3: max 1.4
