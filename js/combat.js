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
// Celestial Nighthawk (Hunter): Golden Gun becomes one shot. (v1.3: Golden Gun 6x, other supers 4x; v1.3.1: 4x and 2.5x; v1.6: Golden Gun only, kill refund.)
// v1.7: base Golden Gun was cut, so Nighthawk's multiplier rose to keep its one shot at about the same damage.
export const NIGHTHAWK = { goldenGun: 5, refund: 30 };
// Golden Gun damage per shot and splash (before SUPER_POWER and mission scaling). Knock 'Em Down's
// two extra shots cost a little damage per shot. (v1.6: 1100 and 350, no Knock 'Em Down cut.)
export const GOLDEN_GUN = { shot: 850, splash: 270, knockMult: 0.85 };
// Nova Bomb leaves a void field where it lands: damage every tick, plus weaken and suppress. (New in v1.7.)
export const NOVA_FIELD = { life: 6, radius: 6, tick: 0.5, dmg: 50, weaken: 1, suppress: 1 };
/** Class exotics added in v1.6. */
export const LIARS = { t: 5, mult: 2, heal: 40 }; // Liar's Handshake: Cross Counter
export const RAIDEN = { extend: 0.5, maxExtend: 5, window: 1, step: 0.1, maxStacks: 5 }; // Raiden Flux
export const STARFIRE = { refund: 0.2 }; // Starfire Protocol: Solar grenade kills
/** Class exotics added in v1.7. */
export const QUIET = { t: 4, regen: 1.5, heal: 40 }; // Mask of the Quiet One
export const URSA = { perDmg: 0.25, max: 50 }; // Ursa Furiosa: super % per point of blocked damage
export const SENTINEL_GUARD = { cut: 0.95 }; // Sentinel Shield guard (hold right-click): share of incoming damage blocked (85% before v1.8.1)
export const HALLOWFIRE = { regen: 1.6 }; // Hallowfire Heart
export const GRAVITON = { dur: 1.5, melee: 2, heal: 15 }; // Graviton Forfeit (heal per second)
export const AHAMKARA = { refund: 0.05, gap: 0.2 }; // Young Ahamkara's Spine (per grenade hit, at most once per gap)
export const RASPBERRY = { chains: 2, refund: 0.3 }; // Lucky Raspberry
export const ORPHEUS = { perEnemy: 5, max: 50 }; // Orpheus Rig
export const DIRE = { perKill: 5, max: 40, t: 5, cut: 0.7 }; // Skull of Dire Ahamkara
export const SUNBRACERS = { t: 5, gap: 0.8 }; // Sunbracers: free grenades, at most one per gap
export const STORMDANCER = { extend: 0.5, maxExtend: 5, step: 0.1, maxStacks: 5 }; // Stormdancer's Brace

// ---------- ability cooldowns ----------
// v1.7: every grenade, melee and class ability cooldown is multiplied by these, and a kill takes
// less off each cooldown, so abilities hit hard but come back slower and weapons carry the fight.
export const ABILITY_CD = { grenade: 1.5, melee: 1.5, class: 1.3 };
export const KILL_CD_REFUND = 0.3; // seconds off every ability cooldown per kill (v1.6: 0.6)
// super damage multiplier (v1.1: 2.2)
export const SUPER_POWER = 2.0;

// ---------- Song of Flame ----------
export const SONG = { duration: 10, abilityRegen: 4 }; // v1.1: 12 s, 8x
// How long each super lasts (seconds). Burst supers are short: the cast, then their effects play out.
export const SUPER_TIME = { hammers: 15, revolver: 12, nova: 0.8, fists: 14, tether: 10, stormtrance: 12, staff: 14, sentinel: 15, songflame: SONG.duration,
  maul: 15, thundercrash: 3.2, wardofdawn: 0.8, twilight: 6, bladebarrage: 1.2, spectral: 12, gathering: 1.6, stormsedge: 6, well: 1.0, novawarp: 10, chaosreach: 4.5, daybreak: 12 };
// Light Ascendant supers (base numbers before superDmg scaling). Tuned so a full cast deals about what
// the subclass's original super does: roughly 2,500 to 3,000 to one target, more spread over a crowd.
export const SUPER_TUNE = {
  maul: { swing: 300, swingR: 3.2, swingCd: 0.5, slam: 480, slamR: 5, slamCd: 1.4, tornado: 70, burn: 20 },
  thundercrash: { speed: 30, r: 8, dmg: 3000 },
  ward: { r: 7, life: 14, wol: 1.25 },
  twilight: { dmg: 800, r: 4.5, pickup: 500, life: 10 },
  blades: { n: 5, knock: 1, r: 2.5, dmg: 300 },
  spectral: { hit: 260, fin: 460, leap: 500, leapR: 4.5, leapCd: 1.4 },
  gathering: { dmg: 2600, tick: 45, r: 7, field: 5, fieldR: 5 },
  stormsedge: { range: 18, r: 5, dmg: 900 },
  well: { r: 6, life: 15, blast: 500, heal: 30, cut: 0.75, dmg: 1.25 },
  novawarp: { chargeT: 1, r0: 3.5, r1: 7, dmg0: 350, dmg1: 900, warp: 6 },
  chaos: { range: 45, dmg: 60, refund: 45 },
  daybreak: { r: 3, dmg: 340, burn: 20 },
};

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
// v1.5: 35 damage (v1.4: 45), and each enemy takes chain damage at most once per `cd` however many jolted neighbors trigger.
export const JOLT = { dmg: 35, n: 3, r: 8, cd: 0.6 };
// Arc Soul (Stormcaller aspect): v1.5 22 damage every 0.5 s (v1.4: 34 every 0.4 s). Its kills give weapon-kill super only.
export const ARC_SOUL = { dmg: 22, tick: 0.5, life: 10 };

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
