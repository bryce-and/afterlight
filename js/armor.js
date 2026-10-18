// Armor 2.0 (v1.5): six stats, mods, energy, orbs of power and armor charge.
// Pure data and rules (no DOM, no Three.js) so tools/tests.html can check them directly.
import { clamp } from './util.js';

export const MODS_LEVEL = 5; // the mod system (screen, sockets, orbs, charge) opens at this level
export const SOCKETS = 4; // socket 0 takes stat mods only
export const STAT_CAP = 100;

// ---------- stats ----------
export const STAT_KEYS = ['mob', 'res', 'rec', 'dis', 'int', 'str'];
export const STATS = {
  mob: { name: 'Mobility', desc: 'Move speed and jump height. Hunters: dodge cooldown.' },
  res: { name: 'Resilience', desc: 'Shield size. Titans: barricade cooldown.' },
  rec: { name: 'Recovery', desc: 'Shield recharge delay and rate. Warlocks: rift cooldown.' },
  dis: { name: 'Discipline', desc: 'Grenade cooldown.' },
  int: { name: 'Intellect', desc: 'Passive super energy gain.' },
  str: { name: 'Strength', desc: 'Powered melee cooldown.' },
};
/** The stat that drives each class's class ability cooldown (Destiny 2: dodge, barricade, rift). */
export const CLASS_STAT = { vanguard: 'res', stalker: 'mob', arcanist: 'rec' };
/** Every class starts with a signature stat; with a full legendary set the others land on tier 5. */
const mkBase = (main) => Object.fromEntries(STAT_KEYS.map((k) => [k, k === main ? 26 : 14]));
export const CLASS_BASE = { vanguard: mkBase('res'), stalker: mkBase('mob'), arcanist: mkBase('rec') };

/** Stat total on a rolled armor piece, by rarity (plus or minus 2). */
export const ARMOR_TOTAL = { common: 34, uncommon: 40, rare: 46, legendary: 54, exotic: 60 };
/** Energy a piece can spend on mods. */
export const MOD_ENERGY = { common: 4, uncommon: 6, rare: 8, legendary: 10, exotic: 10 };

export const tierOf = (v) => clamp(Math.floor(v / 10), 0, 10);
/** Piecewise-linear by tier: lo at tier 0, mid at tier 5, hi at tier 10. */
export const tierScale = (t, lo, mid, hi) => (t <= 5 ? lo + ((mid - lo) * t) / 5 : mid + ((hi - mid) * (t - 5)) / 5);
/** Cooldown multiplier for a stat value: 1.3x at tier 0, 1.0x at 5, 0.65x at 10. */
export const cooldownMult = (v) => tierScale(tierOf(v), 1.3, 1.0, 0.65);
/** Passive super gain multiplier for Intellect: 0.8x, 1.0x, 1.3x. */
export const superRateMult = (v) => tierScale(tierOf(v), 0.8, 1.0, 1.3);
export const COOLDOWN_FLOOR = 0.4;

// Calibrated so a full legendary set (stat 50, tier 5) matches the v1.4 values.
export const speedMult = (mob) => 1 + mob * 0.005;
export const jumpBonus = (mob) => mob * 0.0125;
export const shieldMax = (res) => Math.round(55 + res * 1.2);
export const regenDelay = (rec) => clamp(4.6 - rec * 0.04, 1.6, 4.6);
// v1.7: health and shield regenerate 25% slower (v1.6: 40 + rec).
export const REGEN_SCALE = 0.75;
export const regenRate = (rec) => (40 + rec * 1.0) * REGEN_SCALE;

// ---------- orbs of power and armor charge ----------
export const ORB = { life: 20, r: 1.7, super: 4, heal: 15, charge: 1, weaponKills: 3, window: 4, superMax: 4, harmonicKills: 2, harmonicWindow: 3, harmonicGap: 5, energy: 0.1 };
export const CHARGE = { max: 3, decay: 10, timeDil: 0.5, font: 20, surge: [1, 1.1, 1.17, 1.22] };
export const MODS_TUNE = {
  grenadier: 0.15, brawler: 0.15, kickstart: 0.2, plating: 0.08, reserves: 0.2, recuperation: 15,
  finderS: 0.05, finderH: 0.03, target: 0.1, targetAim: 0.2, loader: 0.15, scav: 0.5,
  concussive: 0.25, meleeRes: 0.25, emergency: { cut: 0.2, t: 4, cd: 15 }, unflinching: 0.25,
  impact: 0.1, momentum: 0.1, bolstering: 0.1, // energy on hit, as a share of the cooldown
  betterAlready: true,
};

// ---------- mods ----------
const stat = (key, amount, cost) => ({ name: `${amount >= 10 ? 'Major' : 'Minor'} ${STATS[key].name} Mod`, slot: 'any', stat: key, amount, cost, unlock: MODS_LEVEL, desc: `+${amount} ${STATS[key].name}.` });
const m = (slot, name, cost, unlock, desc) => ({ slot, name, cost, unlock, desc });
const pct = (x) => `${Math.round(x * 100)}%`;
const S = MODS_LEVEL; // starter: available as soon as the mod system opens

export const MODS = {};
for (const k of STAT_KEYS) {
  const hard = ['dis', 'int', 'str'].includes(k);
  MODS[`${k}5`] = stat(k, 5, hard ? 2 : 1);
  MODS[`${k}10`] = stat(k, 10, hard ? 4 : 3);
}
Object.assign(MODS, {
  // helmet
  handson: m('helmet', 'Hands-On', 3, S, 'Melee and ability kills give extra super energy.'),
  dynamo: m('helmet', 'Dynamo', 3, S, 'Super charges 8% faster.'),
  harmonic: m('helmet', 'Harmonic Siphon', 1, S, `Two rapid kills with weapons of your subclass element create an Orb of Power (once per ${ORB.harmonicGap}s).`),
  finders: m('helmet', 'Special Ammo Finder', 3, S, 'Kills drop Special ammo bricks more often.'),
  finderh: m('helmet', 'Heavy Ammo Finder', 3, S, 'Kills drop Heavy ammo bricks more often.'),
  targetp: m('helmet', 'Primary Targeting', 1, 6, 'Primary weapons: 10% tighter aimed spread and faster aim-in.'),
  targets: m('helmet', 'Special Targeting', 2, 10, 'Special weapons: 10% tighter aimed spread and faster aim-in.'),
  targeth: m('helmet', 'Heavy Targeting', 2, 15, 'Heavy weapons: 10% tighter aimed spread and faster aim-in.'),
  betteralready: m('helmet', 'Better Already', 2, S, 'Picking up an Orb of Power starts your shield recharging at once.'),
  fontwisdom: m('helmet', 'Font of Intellect', 3, 27, `+${CHARGE.font} Intellect while you have armor charge.`),
  // arms
  grenadier: m('arms', 'Grenade Kickstart', 4, S, 'Grenade recharges 15% faster.'),
  brawler: m('arms', 'Melee Kickstart', 4, S, 'Powered melee recharges 15% faster.'),
  firepower: m('arms', 'Firepower', 2, S, 'Grenade kills create an Orb of Power (once per throw).'),
  heavyhanded: m('arms', 'Heavy Handed', 2, S, 'Powered melee kills create an Orb of Power.'),
  reaper: m('arms', 'Reaper', 3, 7, 'Class ability kills create an Orb of Power.'),
  impact: m('arms', 'Impact Induction', 3, 9, 'Powered melee hits give 10% grenade energy.'),
  momentum: m('arms', 'Momentum Transfer', 3, 13, 'Grenade hits give 10% melee energy.'),
  bolstering: m('arms', 'Bolstering Detonation', 2, 17, 'Grenade hits give 10% class ability energy.'),
  loaderp: m('arms', 'Primary Loader', 2, 8, '15% faster reload for Primary weapons.'),
  loaders: m('arms', 'Special Loader', 2, 11, '15% faster reload for Special weapons.'),
  loaderh: m('arms', 'Heavy Loader', 3, 16, '15% faster reload for Heavy weapons.'),
  fontmight: m('arms', 'Font of Strength', 3, 20, `+${CHARGE.font} Strength while you have armor charge.`),
  fontdiscipline: m('arms', 'Font of Discipline', 3, 24, `+${CHARGE.font} Discipline while you have armor charge.`),
  // chest
  plating: m('chest', 'Resilient Plating', 3, S, 'Take 8% less damage.'),
  reserves: m('chest', 'Ammo Reserves', 2, S, '+20% reserve ammo for Special and Heavy weapons.'),
  concussive: m('chest', 'Concussive Dampener', 2, 12, 'Take 25% less splash damage.'),
  meleeres: m('chest', 'Melee Damage Resistance', 2, 18, 'Take 25% less damage from enemy melee attacks.'),
  emergency: m('chest', 'Emergency Reinforcement', 3, 25, `When your shield breaks, take 20% less damage for ${MODS_TUNE.emergency.t}s (once per ${MODS_TUNE.emergency.cd}s).`),
  unflinching: m('chest', 'Unflinching Aim', 1, 22, 'Much less view shake when you are hit while aiming.'),
  chargedup: m('chest', 'Charged Up', 3, S, 'Hold one more stack of armor charge.'),
  timedil: m('chest', 'Time Dilation', 2, 19, 'Armor charge lasts 50% longer.'),
  scavs: m('chest', 'Special Ammo Scavenger', 2, 14, 'Special ammo bricks give 50% more ammo.'),
  scavh: m('chest', 'Heavy Ammo Scavenger', 3, 21, 'Heavy ammo bricks give 50% more ammo.'),
  fontendurance: m('chest', 'Font of Recovery', 3, 30, `+${CHARGE.font} Recovery while you have armor charge.`),
  fontresilience: m('chest', 'Font of Resilience', 3, 29, `+${CHARGE.font} Resilience while you have armor charge.`),
  // legs
  kickstart: m('legs', 'Utility Kickstart', 4, S, 'Class ability recharges 20% faster.'),
  recuperation: m('legs', 'Recuperation', 3, S, 'Kills restore 15 health.'),
  innervation: m('legs', 'Innervation', 2, S, 'Picking up an Orb of Power gives 10% grenade energy.'),
  invigoration: m('legs', 'Invigoration', 2, S, 'Picking up an Orb of Power gives 10% melee energy.'),
  insulation: m('legs', 'Insulation', 2, S, 'Picking up an Orb of Power gives 10% class ability energy.'),
  stacks: m('legs', 'Stacks on Stacks', 3, S, 'Orbs of Power give one more stack of armor charge.'),
  fontmobility: m('legs', 'Font of Mobility', 3, 26, `+${CHARGE.font} Mobility while you have armor charge.`),
});
export const SURGE_ELEMENTS = ['kinetic', 'solar', 'arc', 'void', 'stasis', 'strand'];
const SURGE_UNLOCK = { solar: S, arc: S, void: S, kinetic: 23, stasis: 28, strand: 29 };
for (const el of SURGE_ELEMENTS) {
  const nm = el[0].toUpperCase() + el.slice(1);
  MODS[`surge_${el}`] = m('legs', `${nm} Surge`, 3, SURGE_UNLOCK[el], `${nm} weapons deal more damage while you have armor charge (+10% with one, +17% with two, +22% with three).`);
}
for (const id of Object.keys(MODS)) MODS[id].id = id;
export const MOD_IDS = Object.keys(MODS);
/** U9: one Font per stat, named after the stat (ids kept from v1.5 so saves are unchanged). */
export const FONT_STAT = { fontwisdom: 'int', fontmight: 'str', fontendurance: 'rec', fontdiscipline: 'dis', fontmobility: 'mob', fontresilience: 'res' };
/** U9: mods that use armor charge. Orbs of Power give armor charge only when at least one of these is socketed. */
export const CHARGE_MODS = [...Object.keys(FONT_STAT), ...SURGE_ELEMENTS.map((el) => `surge_${el}`), 'chargedup', 'timedil', 'stacks'];
/** ap: socketed mod counts by id (Player.ap). */
export const usesCharge = (ap) => CHARGE_MODS.some((id) => (ap?.[id] || 0) > 0);
/** The eight former legendary perks keep their ids as mods. */
export const FORMER_PERKS = ['grenadier', 'brawler', 'kickstart', 'dynamo', 'recuperation', 'handson', 'plating', 'reserves'];

/** Mods an armor slot can socket (sockets 1 to 3), in display order. */
export const modsForSlot = (slot) => MOD_IDS.filter((id) => MODS[id].slot === slot);
export const statMods = () => MOD_IDS.filter((id) => MODS[id].slot === 'any');
export const modUnlocked = (id, level) => level >= MODS_LEVEL && level >= (MODS[id]?.unlock ?? Infinity);
/** Mods that unlock exactly at a level (the level-up message). Level 5 lists the starters. */
export const modsUnlockedAt = (level) => MOD_IDS.filter((id) => MODS[id].unlock === level && MODS[id].slot !== 'any');

// ---------- sockets ----------
export const blankMods = () => Array(SOCKETS).fill(null);
export const energyCap = (item) => MOD_ENERGY[item.rarity] ?? 4;
export const energyUsed = (mods) => (mods || []).reduce((n, id) => n + (id && MODS[id] ? MODS[id].cost : 0), 0);
/** Can this mod sit in this socket of this piece? Returns an error string or null. */
export function socketError(item, idx, id) {
  const d = MODS[id];
  if (!d) return 'Unknown mod.';
  if (idx < 0 || idx >= SOCKETS) return 'No such socket.';
  if (idx === 0 ? d.slot !== 'any' : d.slot !== item.slot) return idx === 0 ? 'The first socket takes stat mods only.' : `That mod fits ${d.slot === 'any' ? 'the first socket' : d.slot} armor.`;
  return null;
}
/** The mods that actually work: right socket, unlocked, within energy. Below the mod level nothing works (the choices are kept). */
export function activeMods(item, level) {
  if (!item || item.kind !== 'armor' || level < MODS_LEVEL) return [];
  const out = [];
  let spent = 0;
  const cap = energyCap(item);
  (item.mods || []).forEach((id, i) => {
    if (!id || socketError(item, i, id) || !modUnlocked(id, level) || spent + MODS[id].cost > cap) return;
    spent += MODS[id].cost;
    out.push(id);
  });
  return out;
}
/** Puts a mod (or null) in a socket. Returns an error string, or null on success. */
export function setMod(item, idx, id, level) {
  if (id == null) { item.mods = item.mods || blankMods(); item.mods[idx] = null; return null; }
  const err = socketError(item, idx, id);
  if (err) return err;
  if (!modUnlocked(id, level)) return level < MODS_LEVEL ? `Mods unlock at level ${MODS_LEVEL}.` : `Unlocks at level ${MODS[id].unlock}.`;
  const mods = item.mods || (item.mods = blankMods());
  const rest = energyUsed(mods) - (mods[idx] ? MODS[mods[idx]].cost : 0);
  if (rest + MODS[id].cost > energyCap(item)) return 'Not enough energy.';
  mods[idx] = id;
  return null;
}
/** How many of each active mod across a set of armor pieces. */
export function modCounts(items, level) {
  const c = {};
  for (const it of items) for (const id of activeMods(it, level)) c[id] = (c[id] || 0) + 1;
  return c;
}
/** Six stats for a class wearing these pieces: class base, rolled stats and stat mods. */
export function armorStats(classId, items, level) {
  const st = { ...CLASS_BASE[classId] };
  for (const it of items) {
    if (!it) continue;
    for (const k of STAT_KEYS) st[k] += it.stats?.[k] ?? 0;
    for (const id of activeMods(it, level)) if (MODS[id].stat) st[MODS[id].stat] += MODS[id].amount;
  }
  for (const k of STAT_KEYS) st[k] = clamp(st[k], 0, STAT_CAP);
  return st;
}

// ---------- rolling and migration ----------
/** Splits `total` over the six stats by random weights (largest remainder, so the sum is exact). */
export function rollStats(total, rng = Math.random) {
  const w = STAT_KEYS.map(() => 0.4 + rng());
  return splitTotal(total, w);
}
function splitTotal(total, w) {
  const sum = w.reduce((a, b) => a + b, 0);
  const raw = w.map((x) => (x / sum) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]);
  for (let i = 0; left > 0; i++, left--) out[order[i % order.length][1]]++;
  return Object.fromEntries(STAT_KEYS.map((k, i) => [k, out[i]]));
}
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
/**
 * v4 to v5: an armor piece's Mobility, Resilience and Recovery carry over in the same proportions
 * (60% of the new total) and the new Discipline, Intellect and Strength are rolled from the item id
 * (40%), so the result is stable. A high roll for its rarity stays high.
 */
export function migrateArmorStats(item, oldPts) {
  const old = item.stats || { mob: 0, res: 0, rec: 0 };
  const oldTotal = (old.mob || 0) + (old.res || 0) + (old.rec || 0);
  const lo = (oldPts[item.rarity] ?? 10) - 1, hi = lo + 3;
  const pos = clamp((oldTotal - lo) / (hi - lo), 0, 1);
  const total = ARMOR_TOTAL[item.rarity] - 2 + Math.round(pos * 4);
  const rng = seeded(String(item.id));
  const keep = Math.round(total * 0.6);
  const a = splitTotal(keep, [old.mob + 0.5, old.res + 0.5, old.rec + 0.5]);
  const b = splitTotal(total - keep, [0.4 + rng(), 0.4 + rng(), 0.4 + rng()]);
  return { mob: a.mob ?? 0, res: a.res ?? 0, rec: a.rec ?? 0, dis: b.mob ?? 0, int: b.res ?? 0, str: b.rec ?? 0 };
}
