// U24 Roguelike Horde: boons, the run inventory, the wave scaling curve and the fair-spawn rule.
// Pure rules (no DOM, no Three.js) so tools/tests.html can check them, like js/blitz.js. Game code only calls into this file.
// Every boon is one data row. Taking a boon again stacks it: each effect value below is the amount ONE stack adds.
import { mulberry32 } from './util.js';

export const BOON_EVERY = 1;        // a boon choice after every wave (waves 1, 2, 3, ...)
export const BOON_OFFER_SIZE = 3;   // options per member
export const BOON_PICK_SECONDS = 10; // (pre-U30 wave pick timer; pickState still uses it)
export const ORB_IDLE_SECONDS = 12;  // U30 co-op: an open orb menu closes (the orb stays) after this long, so a stalled opener is not stuck in stasis
export const EXOTIC_SHARE = 0.4;         // chance a weapon option is an exotic (H37: was 0.1)

/**
 * The boon table. `fx` keys are read through boonTotals(); values are per stack.
 *  rate*    : added to a charge-speed multiplier (1 stack = 2x, 2 stacks = 3x)
 *  flag     : a yes/no effect, any stack turns it on (the `n` is still counted for strength where noted)
 */
export const BOONS = [
  { id: 'grenadiers_haste', name: "Grenadier's Haste", desc: 'Grenade charges 60% faster', fx: { grenadeRate: 0.6 } },
  { id: 'bladefury', name: 'Bladefury', desc: 'Melee charges 60% faster', fx: { meleeRate: 0.6 } },
  { id: 'lightbringer', name: 'Lightbringer', desc: 'Super charges 60% faster', fx: { superRate: 0.6 } },
  { id: 'second_wind', name: 'Second Wind', desc: 'Class ability charges 60% faster', fx: { classRate: 0.6 } },
  { id: 'heavy_harvest', name: 'Heavy Harvest', desc: 'Grenade kills grant heavy ammo', fx: { grenadeHeavy: 1 } },
  { id: 'fleetfoot', name: 'Fleetfoot', desc: 'Sprint 8% faster and jump 8% higher', fx: { speed: 0.08, jump: 0.08 } },
  { id: 'giantslayer', name: 'Giantslayer', desc: '+7% damage to bosses', fx: { bossDmg: 0.07 } },
  { id: 'crown_detonation', name: 'Crown Detonation', desc: 'Precision kills make the corpse explode', fx: { crownBlast: 1 } },
  { id: 'bloodletter', name: 'Bloodletter', desc: 'Kills restore 5% health', fx: { killHeal: 0.05 } },
  { id: 'iron_skin', name: 'Iron Skin', desc: 'Take about 7% less damage', fx: { toughness: 0.08 } },
  { id: 'shieldwall', name: 'Shieldwall', desc: '+15% maximum shield', fx: { shieldMax: 0.15 } },
  { id: 'quickhands', name: 'Quickhands', desc: 'Reload 12% faster', fx: { reload: 0.12 } },
  { id: 'deep_pockets', name: 'Deep Pockets', desc: '+15% magazine size', fx: { mag: 0.15 } },
  { id: 'scavenger', name: 'Scavenger', desc: 'Enemies drop special ammo 30% more often', fx: { specialDrop: 0.3 } },
  { id: 'arc_conductor', name: 'Arc Conductor', desc: 'Precision hits chain lightning to the nearest enemy', fx: { arcChain: 1 } },
  { id: 'scorched_earth', name: 'Scorched Earth', desc: 'Grenades leave burning ground', fx: { scorch: 1 } },
  { id: 'momentum', name: 'Momentum', desc: 'Each kill gives +1% damage for 5 s, stacking to 10', fx: { momentum: 0.01 } },
  { id: 'last_stand', name: 'Last Stand', desc: '+20% damage while below 30% health', fx: { lastStand: 0.20 } },
    { id: 'ricochet_rounds', name: 'Ricochet Rounds', desc: 'Bullets bounce to a second enemy for 30% damage', fx: { ricochet: 1 } },
  { id: 'executioner', name: 'Executioner', desc: '+12% damage to enemies below 30% health', fx: { execute: 0.12 } },
  { id: 'frostbite_rounds', name: 'Frostbite Rounds', desc: 'Hits slow enemies by 10% for 2 s', fx: { frost: 0.10 } },
  { id: 'grave_robber', name: 'Grave Robber', desc: 'Kills refill 3% of the magazine from reserves (at least 1 round)', fx: { gravePct: 0.03 } },
  { id: 'duelist', name: 'Duelist', desc: '+10% damage to elites and minibosses', fx: { eliteDmg: 0.10 } },
  // U30: ten more boons (every effect below is read in boon-run.js or damageMult)
  { id: 'marksman', name: 'Marksman', desc: '+5% damage to everything', fx: { dmg: 0.05 } },
  { id: 'opening_shot', name: 'Opening Shot', desc: '+15% damage to enemies at full health', fx: { opener: 0.15 } },
  { id: 'exposed_nerve', name: 'Exposed Nerve', desc: '+12% damage while your shield is down', fx: { exposed: 0.12 } },
  { id: 'vitality', name: 'Vitality', desc: '+12% maximum health', fx: { hpMax: 0.12 } },
  { id: 'bulwark', name: 'Bulwark', desc: 'Take about 9% less damage while your shield is up', fx: { shieldGuard: 0.10 } },
  { id: 'quick_recovery', name: 'Quick Recovery', desc: 'Health and shield recharge 20% faster and start sooner', fx: { regen: 0.20 } },
  { id: 'overcharge', name: 'Overcharge', desc: 'Kills add 1% to your super', fx: { killSuper: 1 } },
  { id: 'cooldown_rebate', name: 'Cooldown Rebate', desc: 'Kills cut grenade, melee and class cooldowns by a further 2%', fx: { killCd: 0.02 } },
  { id: 'siphon', name: 'Siphon', desc: 'Kills restore 3% of your maximum shield', fx: { killShield: 0.03 } },
  { id: 'multishot', name: 'Multishot', desc: 'Primary weapons fire 50% more bullets per shot (at least +1). Extra bullets deal half damage', fx: { multishot: 1 }, max: 4 },
  { id: 'beacon', name: 'Beacon', desc: '+1 boon orb every round (up to +3)', fx: { dropExtra: 1 }, max: 3 },
  // U31: elemental rounds (read in boon-run.js roundsDeal, afterHit and roundsTick)
  { id: 'cryo_rounds', name: 'Cryo Rounds', desc: 'Hits build slow on enemies; four stacks freeze them', fx: { cryo: 1 } },
  { id: 'burning_rounds', name: 'Burning Rounds', desc: 'Hits set enemies burning for 3 s (12% of the hit per second)', fx: { burnDot: 0.12 } },
  { id: 'toxic_rounds', name: 'Toxic Rounds', desc: 'Hits poison enemies for 5 s (8% of the hit per second, stacking)', fx: { toxic: 0.08 } },
  { id: 'static_rounds', name: 'Static Rounds', desc: 'Hits jolt enemies: the next hit on a jolted enemy arcs lightning to its neighbors', fx: { staticJolt: 1 }, max: 1 },
  { id: 'devouring_rounds', name: 'Devouring Rounds', desc: 'Every 3rd hit weakens the target: it takes 30% more damage for 3 s', fx: { voidWeaken: 1 }, max: 1 },
  { id: 'threadneedle_rounds', name: 'Threadneedle Rounds', desc: 'Precision hits unravel the target', fx: { unravelCrit: 1 }, max: 1 },
  { id: 'blast_rounds', name: 'Blast Rounds', desc: 'Every 6th hit detonates for 50% of its damage in 3 m', fx: { blastRounds: 1 } },
  { id: 'adrenaline_rush', name: 'Adrenaline Rush', desc: 'Kills give +10% move speed for 3 s', fx: { rushSpeed: 0.10 } },
  // H30b: exotic boons. Never in a normal orb; a boss kill always leaves a boss orb that offers three of them. Each stacks up to `max`.
  { id: 'phoenix_rite', name: 'Phoenix Rite', desc: 'Once per wave, survive a killing blow at 1 health', fx: { phoenix: 1 }, exotic: true, max: 3 },
  { id: 'heart_of_the_storm', name: 'Heart of the Storm', desc: 'Kills arc lightning to 2 nearby enemies for half the dead enemy\'s health', fx: { stormKill: 2 }, exotic: true, max: 3 },
  { id: 'undying_will', name: 'Undying Will', desc: '+30% maximum health, faster recovery and kills restore 4% health', fx: { hpMax: 0.30, regen: 0.30, killHeal: 0.04 }, exotic: true, max: 3 },
  { id: 'eternity_engine', name: 'Eternity Engine', desc: 'Grenade, melee, class and super all charge 50% faster', fx: { grenadeRate: 0.5, meleeRate: 0.5, classRate: 0.5, superRate: 0.5 }, exotic: true, max: 3 },
  { id: 'worldbreaker', name: 'Worldbreaker', desc: '+15% damage to everything and +20% to bosses, elites and the nearly dead', fx: { dmg: 0.15, bossDmg: 0.20, eliteDmg: 0.20, execute: 0.20 }, exotic: true, max: 3 },
  { id: 'aegis_of_ages', name: 'Aegis of Ages', desc: '+40% maximum shield, and take about 12% less damage with your shield up', fx: { shieldMax: 0.40, shieldGuard: 0.14 }, exotic: true, max: 3 },
];
export const BOON_BY_ID = Object.fromEntries(BOONS.map((b) => [b.id, b]));
/** How many stacks of a boon can be held (a `max` on the row; 1 means single use, otherwise unlimited). */
export const boonMax = (id) => BOON_BY_ID[id]?.max ?? Infinity;
/** Can another stack of this boon still do something? Single-use and capped boons drop out of offers once held to their max. */
export const boonOpen = (run, id) => (run?.boons?.[id] || 0) < boonMax(id);
const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]/g, '');
/** U31 /give: a boon by id or name. Exact first, then a unique prefix, then a unique substring. Returns { boon } or { error } (error is null when nothing matched). */
export function findBoon(text) {
  const q = norm(text);
  if (!q) return { error: null };
  const exact = BOONS.find((b) => norm(b.id) === q || norm(b.name) === q);
  if (exact) return { boon: exact };
  for (const test of [(n) => n.startsWith(q), (n) => n.includes(q)]) {
    const hits = BOONS.filter((b) => test(norm(b.id)) || test(norm(b.name)));
    if (hits.length === 1) return { boon: hits[0] };
    if (hits.length > 1) return { error: `Which boon? ${hits.slice(0, 6).map((b) => b.id).join(', ')}${hits.length > 6 ? ', ...' : ''}` };
  }
  return { error: null };
}

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
export const damageTakenMult = (t, shieldUp = false) => Math.max(BOON_CONST.toughnessFloor, 1 / (1 + g(t, 'toughness') + (shieldUp ? g(t, 'shieldGuard') : 0)));
/** Reload time multiplier: 20% faster per stack as a rate, never below the floor. */
export const reloadTimeMult = (t) => Math.max(BOON_CONST.reloadFloor, 1 / (1 + g(t, 'reload')));
export const magMult = (t) => 1 + g(t, 'mag');
export const shieldMult = (t) => 1 + g(t, 'shieldMax');
export const speedMult = (t) => 1 + g(t, 'speed');
export const jumpMult = (t) => 1 + g(t, 'jump');
/** Multishot: bullets per trigger pull for a gun that fires `base`. Each stack adds half the base (at least 1); 4 stacks at most. `extra` are the bullets past the base, which deal MULTISHOT_EXTRA_DMG of a normal bullet. */
export const MULTISHOT_EXTRA_DMG = 0.5, MULTISHOT_MAX_STACKS = 4;
export function shotCount(t, base = 1) {
  const n = Math.min(MULTISHOT_MAX_STACKS, Math.round(g(t, 'multishot')));
  const extra = n > 0 ? n * Math.max(1, Math.ceil(base * 0.5)) : 0;
  return { total: base + extra, extra };
}
/** Extra boon orbs a round from Beacon (+1 a stack, never more than +3). */
export const extraDrops = (t) => Math.min(3, Math.round(g(t, 'dropExtra')));
export const specialDropMult = (t) => 1 + g(t, 'specialDrop');
/** Frostbite: the slow fraction one hit applies, never above frostMax. 0 when the boon is not held. */
export const frostSlow = (t) => Math.min(BOON_CONST.frostMax, g(t, 'frost'));

/**
 * The outgoing damage multiplier for one hit. `ctx`: { boss, elite, targetFrac (target health 0-1), selfFrac (own health 0-1), momentumStacks }.
 * All additive terms add to one bonus, so many stacks grow it linearly (never exponentially).
 */
export function damageMult(t, ctx = {}) {
  let bonus = 0;
  bonus += g(t, 'dmg');
  if (ctx.targetFrac != null && ctx.targetFrac >= 0.99) bonus += g(t, 'opener');
  if (ctx.shieldDown) bonus += g(t, 'exposed');
  if (ctx.boss) bonus += g(t, 'bossDmg');
  if (ctx.elite) bonus += g(t, 'eliteDmg');
  if (ctx.targetFrac != null && ctx.targetFrac < BOON_CONST.executeBelow) bonus += g(t, 'execute');
  if (ctx.selfFrac != null && ctx.selfFrac < BOON_CONST.lastStandBelow) bonus += g(t, 'lastStand');
  bonus += g(t, 'momentum') * Math.min(BOON_CONST.momentumMax, ctx.momentumStacks || 0);
  return 1 + bonus;
}

// ---------- the offer ----------
/**
 * H30b: one orb's offer: BOON_OFFER_SIZE different buffs, then ONE weapon swap, so every orb carries a swap (when `weaponPool` has anything).
 * Buffs are drawn from the normal pool (not exotic), and a boon already held to its `max` stacks is left out. A `boss` orb (left by a boss kill)
 * draws its buffs from the exotic pool instead, falls back to normal boons if too few exotics are open, and its swap is always an exotic weapon when one exists.
 * `held`: the run's boon stacks. The weapon is the last card, so the timeout pick (the first option) never swaps a weapon unasked.
 */
export function rollOffer(rnd = Math.random, weaponPool = [], size = BOON_OFFER_SIZE, { held = {}, boss = false } = {}) {
  const open = (b) => (held[b.id] || 0) < boonMax(b.id);
  const take = (arr, n) => { const a = [...arr], r = []; while (a.length && r.length < n) r.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); return r; };
  const exo = BOONS.filter((b) => b.exotic && open(b)), norm = BOONS.filter((b) => !b.exotic && open(b));
  const picked = boss ? take(exo, size) : [];
  if (picked.length < size) picked.push(...take(norm, size - picked.length));
  const out = picked.map((b) => ({ kind: 'boon', id: b.id }));
  if (weaponPool.length) {
    const ex = weaponPool.filter((w) => w.exotic), leg = weaponPool.filter((w) => !w.exotic);
    const from = ex.length && (boss || !leg.length || rnd() < EXOTIC_SHARE) ? ex : leg.length ? leg : ex;
    const w = from[Math.floor(rnd() * from.length)];
    out.push({ kind: 'weapon', slot: w.slot, name: w.name, exotic: !!w.exotic });
  }
  return out;
}
/** Each member rolls separately, so teammates get different offers. `members`: array of ids; returns { id: offer }. */
export function rollOffers(members, rnd = Math.random, weaponPool = [], opts = {}) {
  return Object.fromEntries(members.map((m) => [m, rollOffer(rnd, weaponPool, BOON_OFFER_SIZE, opts)]));
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
/** Kept for old callers: U30 removed the wave-clear boon, so no wave ever earns a pick by clearing. Boons come from drops (below). */
export const boonDue = () => false;

// ---------- U30 boon drops: orbs left by kills (Risk of Rain style) ----------
export const DROPS_MIN = 2, DROPS_MAX = 30;
/** U31: a round drops a share of its enemies as orbs. The share starts at 6% and gains 0.5% a wave, capped at 18%, so later waves (more enemies) drop more. */
export const DROP_RATE = { base: 0.06, perWave: 0.005, max: 0.18 };
export const dropRate = (wave = 1) => Math.min(DROP_RATE.max, DROP_RATE.base + DROP_RATE.perWave * Math.max(0, wave - 1));
export const DROP_ELITE_WEIGHT = 2.5; // an elite, major or boss kill is this much likelier to drop the orb than a grunt
/** How many orbs one round drops: enemyCount x dropRate(wave), rounded up or down by chance (`rnd` 0..1), at least DROPS_MIN. */
export function rollDropBudget(enemyCount, rnd = Math.random, wave = 1) {
  const want = Math.max(0, enemyCount) * dropRate(wave), base = Math.floor(want);
  const n = base + (rnd() < want - base ? 1 : 0);
  return Math.min(DROPS_MAX, Math.max(DROPS_MIN, n));
}
/** A round's drop plan: `left` orbs still to drop over `remaining` expected kills. */
export const newDropPlan = (enemyCount, rnd = Math.random, extra = 0, wave = 1) => ({ left: rollDropBudget(enemyCount, rnd, wave) + extra, remaining: Math.max(1, enemyCount), seq: 0 });
/**
 * Called once per kill by whoever decides (solo, or the host). Returns true if this kill drops an orb. Spreads the budget over the
 * round's kills, leans toward elites, and always drops once the kills left only just cover the orbs left (so a round never ends short).
 */
export function shouldDropBoon(plan, weight = 1, rnd = Math.random) {
  if (!plan || plan.left <= 0) { if (plan) plan.remaining = Math.max(0, plan.remaining - 1); return false; }
  const p = plan.remaining <= plan.left ? 1 : Math.min(1, (plan.left / plan.remaining) * weight);
  plan.remaining = Math.max(0, plan.remaining - 1);
  if (rnd() < p) { plan.left--; plan.seq++; return true; }
  return false;
}
/** The offer for one orb is seeded from the drop id and the player's slot, so a reopened or reconnected orb shows the same three choices. */
export const offerSeed = (wave, dropId, playerIdx) => ((wave * 7919 + dropId * 104729 + playerIdx * 1299709 + 0x9e3779b9) >>> 0);
/** Same as rollOffer but from the drop's seed. */
export const rollOrbOffer = (seed, weaponPool = [], opts = {}) => rollOffer(mulberry32(seed), weaponPool, BOON_OFFER_SIZE, opts);
/** H30b: a boss kill's orb id ends in 99 (regular orbs count up from 1, never past 33). */
export const BOSS_ORB_SLOT = 99;
export const isBossOrb = (id) => id % 100 === BOSS_ORB_SLOT;

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
