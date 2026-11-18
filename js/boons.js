// U24 Roguelike Horde: boons, the run inventory, the wave scaling curve and the fair-spawn rule.
// Pure rules (no DOM, no Three.js) so tools/tests.html can check them, like js/blitz.js. Game code only calls into this file.
// Every boon is one data row. Taking a boon again stacks it: each effect value below is the amount ONE stack adds.
import { mulberry32 } from './util.js';

export const BOON_EVERY = 1;        // a boon choice after every wave (waves 1, 2, 3, ...)
export const BOON_OFFER_SIZE = 3;   // options per member
export const BOON_PICK_SECONDS = 10; // the first option is taken on timeout
export const WEAPON_OFFER_CHANCE = 0.4;  // chance each option is a weapon swap instead of a buff (H37: was 0.25)
export const EXOTIC_SHARE = 0.4;         // chance a weapon option is an exotic (H37: was 0.1)

/**
 * The boon table. `fx` keys are read through boonTotals(); values are per stack.
 *  rate*    : added to a charge-speed multiplier (1 stack = 2x, 2 stacks = 3x)
 *  flag     : a yes/no effect, any stack turns it on (the `n` is still counted for strength where noted)
 */
export const BOONS = [
  { id: 'grenadiers_haste', name: "Grenadier's Haste", desc: 'Grenade charges twice as fast', fx: { grenadeRate: 1 } },
  { id: 'bladefury', name: 'Bladefury', desc: 'Melee charges twice as fast', fx: { meleeRate: 1 } },
  { id: 'lightbringer', name: 'Lightbringer', desc: 'Super charges twice as fast', fx: { superRate: 1 } },
  { id: 'second_wind', name: 'Second Wind', desc: 'Class ability charges twice as fast', fx: { classRate: 1 } },
  { id: 'heavy_harvest', name: 'Heavy Harvest', desc: 'Grenade kills grant heavy ammo', fx: { grenadeHeavy: 1 } },
  { id: 'fleetfoot', name: 'Fleetfoot', desc: 'Sprint faster and jump higher', fx: { speed: 0.15, jump: 0.15 } },
  { id: 'giantslayer', name: 'Giantslayer', desc: '+10% damage to bosses', fx: { bossDmg: 0.10 } },
  { id: 'crown_detonation', name: 'Crown Detonation', desc: 'Precision kills make the corpse explode', fx: { crownBlast: 1 } },
  { id: 'bloodletter', name: 'Bloodletter', desc: 'Kills restore 10% health', fx: { killHeal: 0.10 } },
  { id: 'iron_skin', name: 'Iron Skin', desc: 'Take 10% less damage', fx: { toughness: 0.10 } },
  { id: 'shieldwall', name: 'Shieldwall', desc: '+25% maximum shield', fx: { shieldMax: 0.25 } },
  { id: 'quickhands', name: 'Quickhands', desc: 'Reload 20% faster', fx: { reload: 0.20 } },
  { id: 'deep_pockets', name: 'Deep Pockets', desc: '+25% magazine size', fx: { mag: 0.25 } },
  { id: 'scavenger', name: 'Scavenger', desc: 'Enemies drop special ammo more often', fx: { specialDrop: 0.5 } },
  { id: 'arc_conductor', name: 'Arc Conductor', desc: 'Precision hits chain lightning to the nearest enemy', fx: { arcChain: 1 } },
  { id: 'scorched_earth', name: 'Scorched Earth', desc: 'Grenades leave burning ground', fx: { scorch: 1 } },
  { id: 'momentum', name: 'Momentum', desc: 'Each kill gives +2% damage for 5 s, stacking to 10', fx: { momentum: 0.02 } },
  { id: 'last_stand', name: 'Last Stand', desc: '+30% damage while below 30% health', fx: { lastStand: 0.30 } },
  { id: 'phoenix_rite', name: 'Phoenix Rite', desc: 'Once per wave, survive a killing blow at 1 health', fx: { phoenix: 1 } },
  { id: 'ricochet_rounds', name: 'Ricochet Rounds', desc: 'Bullets bounce to a second enemy for 30% damage', fx: { ricochet: 1 } },
  { id: 'executioner', name: 'Executioner', desc: '+20% damage to enemies below 30% health', fx: { execute: 0.20 } },
  { id: 'frostbite_rounds', name: 'Frostbite Rounds', desc: 'Hits slow enemies by 15% for 2 s', fx: { frost: 0.15 } },
  { id: 'grave_robber', name: 'Grave Robber', desc: 'Kills refill 5% of the magazine from reserves', fx: { gravePct: 0.05 } },
  { id: 'duelist', name: 'Duelist', desc: '+15% damage to elites and minibosses', fx: { eliteDmg: 0.15 } },
  { id: 'adrenaline_rush', name: 'Adrenaline Rush', desc: 'Kills give +20% move speed for 3 s', fx: { rushSpeed: 0.20 } },
];
export const BOON_BY_ID = Object.fromEntries(BOONS.map((b) => [b.id, b]));

/** Fixed numbers the effect code reads (not per stack). Kept here so tuning never touches game code. */
export const BOON_CONST = {
  momentumMax: 10, momentumSecs: 5,      // Momentum: stacks of kill bonus, and how long each lasts
  lastStandBelow: 0.30, executeBelow: 0.30,
  rushSecs: 3, frostSecs: 2, frostMax: 0.8, // Frostbite slows at most 80%
  ricochetDmg: 0.30, ricochetRange: 9,    // Ricochet Rounds: damage fraction and search radius (m)
  crownBlastRadius: 4, crownBlastDmg: 0.6, // Crown Detonation: radius (m) and fraction of the kill's damage
  scorchSecs: 4,
  toughnessFloor: 0.2, reloadFloor: 0.25,  // damage taken never below 20%, reload time never below 25%
};

// ---------- the run inventory ----------
/** A fresh run inventory: boons (id to stack count), swapped weapons (slot to { name, exotic }), and the picks made. */
export const newBoonRun = () => ({ boons: {}, weapons: {}, picks: 0 });
/** Resets the run inventory in place (death, clear or a new run). Caches never touch it. */
export function resetBoonRun(run) { run.boons = {}; run.weapons = {}; run.picks = 0; return run; }
export const boonCount = (run, id) => run.boons[id] || 0;
export const totalBoons = (run) => Object.values(run.boons).reduce((a, n) => a + n, 0);

/** Adds one stack of a boon. Returns the new stack count. Throws on an unknown id. */
export function addBoon(run, id) {
  if (!BOON_BY_ID[id]) throw new Error(`addBoon: no boon called ${id}`);
  run.boons[id] = (run.boons[id] || 0) + 1;
  run.picks++;
  return run.boons[id];
}
/** Swaps the weapon in a slot for the rest of the run. */
export function swapWeapon(run, slot, name, exotic = false) {
  if (!slot || !name) throw new Error('swapWeapon: needs a slot and a weapon name');
  run.weapons[slot] = { name, exotic: !!exotic };
  run.picks++;
  return run.weapons[slot];
}

/**
 * Sums every effect over the run's stacks: { grenadeRate: 2, ... }. Missing effects are 0.
 * Use the helpers below for the numbers the game actually multiplies by.
 */
export function boonTotals(run) {
  const t = {};
  for (const [id, n] of Object.entries(run.boons)) {
    const b = BOON_BY_ID[id];
    if (!b) continue;
    for (const [k, v] of Object.entries(b.fx)) t[k] = (t[k] || 0) + v * n;
  }
  return t;
}
const g = (t, k) => t[k] || 0;
/** The multiplier each charge runs at: 1 with no boon, 2 with one, 3 with two. */
export const chargeMult = (t, kind) => 1 + g(t, `${kind}Rate`);
/** Damage taken multiplier: 1 with no boon; 10% per stack as a share (1 / (1 + 0.1n)), so it falls forever but never reaches 0. */
export const damageTakenMult = (t) => Math.max(BOON_CONST.toughnessFloor, 1 / (1 + g(t, 'toughness')));
/** Reload time multiplier: 20% faster per stack as a rate, never below the floor. */
export const reloadTimeMult = (t) => Math.max(BOON_CONST.reloadFloor, 1 / (1 + g(t, 'reload')));
export const magMult = (t) => 1 + g(t, 'mag');
export const shieldMult = (t) => 1 + g(t, 'shieldMax');
export const speedMult = (t) => 1 + g(t, 'speed');
export const jumpMult = (t) => 1 + g(t, 'jump');
export const specialDropMult = (t) => 1 + g(t, 'specialDrop');
/** Frostbite: the slow fraction one hit applies, never above frostMax. 0 when the boon is not held. */
export const frostSlow = (t) => Math.min(BOON_CONST.frostMax, g(t, 'frost'));

/**
 * The outgoing damage multiplier for one hit. `ctx`: { boss, elite, targetFrac (target health 0-1), selfFrac (own health 0-1), momentumStacks }.
 * All additive terms add to one bonus, so many stacks grow it linearly (never exponentially).
 */
export function damageMult(t, ctx = {}) {
  let bonus = 0;
  if (ctx.boss) bonus += g(t, 'bossDmg');
  if (ctx.elite) bonus += g(t, 'eliteDmg');
  if (ctx.targetFrac != null && ctx.targetFrac < BOON_CONST.executeBelow) bonus += g(t, 'execute');
  if (ctx.selfFrac != null && ctx.selfFrac < BOON_CONST.lastStandBelow) bonus += g(t, 'lastStand');
  bonus += g(t, 'momentum') * Math.min(BOON_CONST.momentumMax, ctx.momentumStacks || 0);
  return 1 + bonus;
}

// ---------- the offer ----------
/**
 * Rolls one member's offer: BOON_OFFER_SIZE different options, each a buff `{ kind: 'boon', id }` or, with WEAPON_OFFER_CHANCE,
 * a weapon swap `{ kind: 'weapon', slot, name, exotic }` drawn from `weaponPool` ([{ slot, name, exotic }]). Buffs never repeat in one
 * offer (a held boon may be offered again, that is how stacking works). With an empty pool every option is a buff.
 */
export function rollOffer(rnd = Math.random, weaponPool = [], size = BOON_OFFER_SIZE) {
  const out = [], ids = new Set(), names = new Set();
  const buffs = [...BOONS], pool = [...weaponPool];
  while (out.length < size) {
    if (pool.length && rnd() < WEAPON_OFFER_CHANCE) {
      // exotics are still rarer than legendaries (EXOTIC_SHARE of weapon options)
      const exo = pool.filter((w) => w.exotic), leg = pool.filter((w) => !w.exotic);
      const from = exo.length && (!leg.length || rnd() < EXOTIC_SHARE) ? exo : leg.length ? leg : exo;
      const w = from[Math.floor(rnd() * from.length)];
      if (!names.has(w.name)) { names.add(w.name); out.push({ kind: 'weapon', slot: w.slot, name: w.name, exotic: !!w.exotic }); }
      pool.splice(pool.indexOf(w), 1);
      continue;
    }
    if (!buffs.length) break;
    const b = buffs.splice(Math.floor(rnd() * buffs.length), 1)[0];
    if (!ids.has(b.id)) { ids.add(b.id); out.push({ kind: 'boon', id: b.id }); }
  }
  return out.sort((a, b) => (a.kind === 'boon' ? 0 : 1) - (b.kind === 'boon' ? 0 : 1)); // buffs first: the timeout pick (the first option) never swaps a weapon unasked
}
/** Each member rolls separately, so teammates get different offers. `members`: array of ids; returns { id: offer }. */
export function rollOffers(members, rnd = Math.random, weaponPool = []) {
  return Object.fromEntries(members.map((m) => [m, rollOffer(rnd, weaponPool)]));
}
/** Which option is taken on timeout: the first. */
export const autoPick = (offer) => { if (!offer?.length) throw new Error('autoPick: empty offer'); return 0; };
/** Applies an offer option to the run. Returns the option applied. */
export function applyOption(run, option) {
  if (option.kind === 'boon') addBoon(run, option.id);
  else if (option.kind === 'weapon') swapWeapon(run, option.slot, option.name, option.exotic);
  else throw new Error(`applyOption: unknown option kind ${option.kind}`);
  return option;
}
/** True when the wave just cleared earns a boon choice (wave 1, then every BOON_EVERY waves: now every wave, but not after the last wave). */
export const boonDue = (wave, totalWaves) => wave > 0 && (wave - 1) % BOON_EVERY === 0 && wave < totalWaves;

/**
 * The host's wave-break timer for the pick. `picked`: Set of member ids who have picked. Counts down once per update.
 * Returns { done, remaining, timedOut: [ids] } (timedOut members are auto-picked by the caller when the timer ends).
 */
export function pickState(members, picked, elapsed, limit = BOON_PICK_SECONDS) {
  const waiting = members.filter((m) => !picked.has(m));
  const ended = elapsed >= limit;
  return { done: !waiting.length || ended, remaining: Math.max(0, limit - elapsed), timedOut: ended ? waiting : [] };
}

// ---------- enemy scaling (data, tuned with playcheck) ----------
/** Per wave past 1: more enemies, tougher enemies, harder hits; bosses grow faster. Caps stop it running away. */
export const HORDE_SCALE = {
  countPerWave: 0.035, countMax: 2.2,
  hpPerWave: 0.06, hpMax: 4,
  dmgPerWave: 0.02, dmgMax: 1.6,
  bossHpPerWave: 0.02, bossHpMax: 1.6, // H35b: bosses use this curve alone (game.js divides out the normal hp curve)
};
/**
 * Roguelike Endless: the same start as Horde, but nothing levels off. Past wave 30 the slopes steepen, because boons stack without end
 * and a flat curve would let a long run coast. Only the enemy count is capped (frame rate); health, damage and boss health keep rising.
 */
export const ENDLESS_SCALE = {
  countPerWave: 0.04, countMax: 3.5,
  hpPerWave: 0.07, hpMax: Infinity,
  dmgPerWave: 0.025, dmgMax: Infinity,
  bossHpPerWave: 0.03, bossHpMax: Infinity,
};
/** The multipliers for a wave (1-based): { count, hp, dmg, bossHp }. Wave 1 is exactly 1 for all four. */
export function waveScale(wave, S = HORDE_SCALE) {
  const w = Math.max(0, wave - 1);
  return {
    count: Math.min(S.countMax, 1 + S.countPerWave * w),
    hp: Math.min(S.hpMax, 1 + S.hpPerWave * w),
    dmg: Math.min(S.dmgMax, 1 + S.dmgPerWave * w),
    bossHp: Math.min(S.bossHpMax, 1 + S.bossHpPerWave * w),
  };
}

// ---------- fair spawns ----------
/** Distances (m): nothing spawns closer than these. */
export const SPAWN_RULES = { suicideFromPlayer: 15, enemyFromPlayer: 15, playerFromSuicide: 15, playerFromEnemy: 8 };
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
/** Is point `p` {x,z} a fair spot for an enemy to appear? `players`: living players' positions. `suicide`: the spawning unit is a suicide unit. */
export function enemySpotOk(p, players, suicide, R = SPAWN_RULES) {
  const min = suicide ? R.suicideFromPlayer : R.enemyFromPlayer;
  return players.every((q) => d2(p, q) >= min * min);
}
/** Is point `p` {x,z} a fair spot for a player to appear? `enemies`: [{x,z,suicide}] living enemies. */
export function playerSpotOk(p, enemies, R = SPAWN_RULES) {
  return enemies.every((e) => d2(p, e) >= (e.suicide ? R.playerFromSuicide : R.playerFromEnemy) ** 2);
}
/**
 * Picks the first fair candidate from a shuffled list; when none is fair, the one farthest from the nearest threat (never fails).
 * `fair(p)` is enemySpotOk or playerSpotOk bound to the current state; `score(p)` is the distance to the nearest threat.
 */
export function pickFairSpot(candidates, fair, score, rnd = Math.random) {
  if (!candidates.length) throw new Error('pickFairSpot: no candidates');
  const order = [...candidates].sort(() => rnd() - 0.5);
  const ok = order.find(fair);
  if (ok) return ok;
  return order.reduce((best, p) => (score(p) > score(best) ? p : best), order[0]);
}
/** The distance (m) from p to the nearest of `things` ({x,z}); Infinity when there are none. */
export const nearestDist = (p, things) => things.reduce((m, q) => Math.min(m, Math.sqrt(d2(p, q))), Infinity);

/** Deterministic candidate ring for tests and the game: `n` points around (cx,cz) between r0 and r1, from a seed. */
export function ringCandidates(cx, cz, r0, r1, n, seed = 1) {
  const rng = mulberry32(seed), out = [];
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, r = r0 + rng() * (r1 - r0);
    out.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r });
  }
  return out;
}
