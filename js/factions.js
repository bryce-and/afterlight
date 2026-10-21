// U14 New Factions: pure data and rules (no scene), so tools/tests.js can exercise them.
// Taken and Scorn as full factions: unit roster (Destiny 2 names), their stats on top of the five base
// classes, which skills each unit runs, how mission zones mix factions, and what a wave of each faction holds.
// Unit sheets come from Destiny 2 (Destinypedia). Shield elements where the sources disagreed are marked.
import { ENEMY_TYPES } from './data.js';

// ---- factions ----
// `colors` replace the destination's enemy colors for these units (the mission's own scenery colors are untouched).
export const FACTIONS = {
  taken: {
    name: 'Taken', short: 'Taken',
    colors: { enemy: 0x14131c, enemy2: 0x07070c, eye: 0xf2f6ff },
    shot: 0xdfe8ff,
  },
  scorn: {
    name: 'Scorn', short: 'Scorn',
    colors: { enemy: 0x8b8470, enemy2: 0x3a342c, eye: 0xc37aff },
    shot: 0xb46bff,
  },
};
export function isNewFaction(f) { return !!FACTIONS[f]; }

// ---- profiles ----
// Same shape as tiers.js FACTION_PROFILES. Taken blink and weave; Scorn charge, never hide, and rush even alone.
export const NEW_PROFILES = {
  taken: { strafe: 1.2, burstMul: 1, coverMul: 0.6, rushAlone: false, jet: false },
  scorn: { strafe: 0.4, burstMul: 0.8, coverMul: 0, rushAlone: true, jet: false },
};

// ---- units ----
// Each unit extends one of the five base classes (`base`), which keeps cover, stagger, XP, drops and close
// melee working. `skills` are run by enemy-skills.js. `shield` is an elemental shield (weighted list, as in tiers.js).
// `sources` marks the one thing the research could not confirm.
export const UNITS = {
  // ---- Taken (Hive, Fallen and Cabal corrupted by the Darkness) ----
  tk_thrall:    { faction: 'taken', base: 'rusher', name: 'Taken Thrall', hp: 90, speed: 7.4, meleeDmg: 18, skills: ['blink'], blink: { cd: [4, 7], range: [6, 10], toward: true } },
  tk_shadow:    { faction: 'taken', base: 'rusher', name: 'Shadow Thrall', hp: 36, speed: 8.0, meleeDmg: 12, scale: 0.8, life: 16, noDrops: true, skills: [] },
  tk_acolyte:   { faction: 'taken', base: 'grunt', name: 'Taken Acolyte', hp: 105, dmg: 6, skills: [] },
  tk_vandal:    { faction: 'taken', base: 'grunt', name: 'Taken Vandal', hp: 100, skills: ['ward'], ward: { below: 0.6, dur: 4.5, mult: 0.35 } },
  tk_psion:     { faction: 'taken', base: 'grunt', name: 'Taken Psion', hp: 85, speed: 3.9, skills: ['clone'], clone: { below: 0.7, hpFrac: 0.5, maxPerZone: 3 } },
  tk_goblin:    { faction: 'taken', base: 'grunt', name: 'Taken Goblin', hp: 80, dmg: 3, speed: 3.2, prefer: 20, skills: ['allyShield'], allyShield: { range: 16, retarget: 2.5 } },
  tk_wizard:    { faction: 'taken', base: 'captain', name: 'Taken Wizard', hp: 260, shield: 140, shieldEl: 'void', prefer: 20, speed: 3.0, skills: ['summon', 'blink'], summon: { type: 'tk_shadow', cd: [11, 15], n: 2, max: 4 }, blink: { cd: [7, 11], range: [5, 8], toward: false } },
  tk_captain:   { faction: 'taken', base: 'captain', name: 'Taken Captain', shieldEl: 'solar', skills: [], throws: 'orb' },
  tk_centurion: { faction: 'taken', base: 'captain', name: 'Taken Centurion', shieldEl: 'arc', skills: ['blink'], blink: { cd: [6, 9], range: [4, 7], toward: false, onHit: true } },
  tk_phalanx:   { faction: 'taken', base: 'heavy', name: 'Taken Phalanx', hp: 760, dmg: 12, burst: 3, burstGap: 0.18, fireCd: [2.4, 3.4], speed: 2.6, skills: ['frontGuard'], frontGuard: { mult: 0.12, knock: { range: 4.5, cd: 7, dmg: 14, push: 11 } } },
  tk_knight:    { faction: 'taken', base: 'heavy', name: 'Taken Knight', hp: 860, shield: 220, shieldEl: 'void', skills: ['blink'], blink: { cd: [7, 11], range: [4, 7], toward: false, onHit: true } },
  tk_ogre:      { faction: 'taken', base: 'heavy', name: 'Taken Ogre', hp: 980, shield: 240, shieldEl: 'void', skills: [], enrage: true },
  // ---- Scorn (Fallen raised by Dark Ether) ----
  sc_screeb:    { faction: 'scorn', base: 'suicide', name: 'Screeb', hp: 55, speed: 7.4, blastMul: 1.35 },
  sc_wraith:    { faction: 'scorn', base: 'rusher', name: 'Scorn Wraith', hp: 105, speed: 7.0, meleeDmg: 20, skills: ['revive'], revive: { delay: [4, 6], hpFrac: 0.4 } },
  sc_ravager:   { faction: 'scorn', base: 'rusher', name: 'Scorn Ravager', hp: 300, speed: 5.4, meleeDmg: 34, scale: 1.3, skills: [] },
  sc_stalker:   { faction: 'scorn', base: 'grunt', name: 'Scorn Stalker', hp: 95, skills: ['revive'], revive: { delay: [4, 6], hpFrac: 0.4 } },
  sc_raider:    { faction: 'scorn', base: 'grunt', name: 'Scorn Raider', hp: 110, skills: ['blink', 'revive'], blink: { cd: [5, 8], range: [7, 12], toward: false, onHit: true }, revive: { delay: [4, 6], hpFrac: 0.4 } },
  sc_lurker:    { faction: 'scorn', base: 'grunt', name: 'Scorn Lurker', hp: 150, speed: 3.0, skills: ['frontGuard'], frontGuard: { mult: 0.2, knock: null } },
  sc_abomination: { faction: 'scorn', base: 'heavy', name: 'Scorn Abomination', hp: 1000, dmg: 14, burst: 2, burstGap: 0.2, fireCd: [2.2, 3.2], shotColor: 0x5fd3ff, skills: [], enrage: true },
  sc_chieftain: { faction: 'scorn', base: 'captain', name: 'Scorn Chieftain', hp: 340, shield: 160, shieldEl: 'solar', skills: ['totem'], totem: { cd: [14, 19], max: 2, life: 22 } },
  sc_totem:     { faction: 'scorn', base: 'grunt', name: 'Ether Totem', hp: 420, speed: 0, static: true, noDrops: true, support: true, scale: 1.0, skills: ['totemAura'], totemAura: { radius: 11, mult: 0.55 } },
};

// Scorn shield elements by unit id are the Ether Totem kinds (Chieftain totems: Ether Bind arc, Ether Torch solar, Ether Shield void).
export const TOTEM_KINDS = [
  { id: 'bind', el: 'arc', name: 'Ether Bind' },
  { id: 'torch', el: 'solar', name: 'Ether Torch' },
  { id: 'shield', el: 'void', name: 'Ether Shield' },
];

/** Register every unit as an ENEMY_TYPES entry (base stats plus overrides). Idempotent. */
export function registerUnits(types = ENEMY_TYPES) {
  for (const [id, u] of Object.entries(UNITS)) {
    if (types[id]) continue;
    const { faction, name, skills, ...stats } = u;
    types[id] = { ...types[u.base], ...stats, unit: id, faction, skills: skills || [] };
  }
  return types;
}
registerUnits();

/** Base class of any type id (the five original types are their own class). */
export function classOf(typeId) { return UNITS[typeId]?.base || typeId; }
export function unitName(typeId) { return UNITS[typeId]?.name || null; }
/** Shield elements for a new-faction unit, or null. */
export function unitShield(typeId) {
  const u = UNITS[typeId];
  if (!u || !u.shieldEl) return null;
  return [u.shieldEl];
}

// ---- rosters ----
// What each faction sends. `min` is the first zone index and the lowest power band where the unit appears; `n(zi, g)` the count.
// `wave`: 0 = opening group, 1 = reinforcements, 'both'. g is the power band (0 and up), zi the zone index.
export const ROSTER = {
  taken: [
    { t: 'tk_thrall',    wave: 'both', n: (zi, g) => 2 + Math.floor(g / 5) + (zi > 0 ? 1 : 0) },
    { t: 'tk_acolyte',   wave: 0,      n: (zi, g) => 2 + Math.floor(g / 4) },
    { t: 'tk_vandal',    wave: 0,      n: (zi, g) => 1 + (zi > 0 ? 1 : 0) },
    { t: 'tk_psion',     wave: 'both', n: (zi, g) => (zi >= 1 || g >= 2 ? 1 : 0) },
    { t: 'tk_goblin',    wave: 1,      n: (zi, g) => (zi >= 1 && g >= 1 ? 1 : 0) },
    { t: 'tk_captain',   wave: 0,      n: (zi, g) => (zi >= 1 || g >= 2 ? 1 : 0) },
    { t: 'tk_centurion', wave: 1,      n: (zi, g) => (zi >= 1 || g >= 2 ? 1 : 0) },
    { t: 'tk_wizard',    wave: 1,      n: (zi, g) => (g >= 2 && zi >= 1 ? 1 : 0) },
    { t: 'tk_phalanx',   wave: 1,      n: (zi, g) => (zi >= 1 && g >= 1 ? 1 : 0) },
    { t: 'tk_knight',    wave: 1,      n: (zi, g) => (zi >= 2 && g >= 2 ? 1 : 0) },
    { t: 'tk_ogre',      wave: 1,      n: (zi, g) => (zi >= 1 && g >= 3 ? 1 : 0) },
  ],
  scorn: [
    { t: 'sc_screeb',    wave: 'both', n: (zi, g) => (zi > 0 ? 1 : 0) + Math.floor(g / 8) },
    { t: 'sc_wraith',    wave: 'both', n: (zi, g) => 2 + Math.floor(g / 5) },
    { t: 'sc_stalker',   wave: 0,      n: (zi, g) => 2 + Math.floor(g / 4) },
    { t: 'sc_raider',    wave: 'both', n: (zi, g) => (zi >= 1 || g >= 1 ? 1 + Math.floor(g / 6) : 0) },
    { t: 'sc_lurker',    wave: 1,      n: (zi, g) => (zi >= 1 && g >= 1 ? 1 : 0) },
    { t: 'sc_ravager',   wave: 1,      n: (zi, g) => (zi >= 1 || g >= 2 ? 1 : 0) },
    { t: 'sc_chieftain', wave: 1,      n: (zi, g) => (g >= 1 && zi >= 1 ? 1 : 0) },
    { t: 'sc_abomination', wave: 1,    n: (zi, g) => (zi >= 1 && g >= 3 ? 1 : 0) },
  ],
};

/** Spawn list for one wave of a new faction: array of unit ids, scaled by `more` (fireteam count multiplier). */
export function composeWave(faction, waveIdx, zi, g, more = 1) {
  const out = [];
  for (const r of ROSTER[faction] || []) {
    if (r.wave !== 'both' && r.wave !== (waveIdx === 0 ? 0 : 1)) continue;
    const n = Math.round(r.n(zi, g) * more);
    for (let i = 0; i < n; i++) out.push(r.t);
  }
  return out;
}

// ---- how a mission mixes factions ----
// A zone has a faction for its opening group and one for its reinforcements: a mission can open on its own
// destination's faction and then be breached. `null` means the destination's own faction. A plan applies to the
// zones listed by index; the boss zone is always the last one.
//   io1 Sacred Ground:  Legion hold the Oasis; the Taken breach into Giant's Scar behind them; the Rupture is Taken all through.
//   ts3 Scorned:        Fallen hold the wrecks; Scorn pour in behind them in the camp; totem procession and arena are Scorn.
export const MISSION_FACTIONS = {
  io1: [[null, null], [null, 'taken'], 'boss:taken'],
  ts3: [[null, null], [null, 'scorn'], ['scorn', 'scorn'], 'boss:scorn'],
};
// Missions that only brush the second faction: a lone reinforcement wave in the deepest zone before the boss.
export const MISSION_TASTE = { io2: 'taken', ts2: 'scorn' };
// Wave activities (Horde/Endless) bring the destination's second faction every third wave.
export const ACTIVITY_SECOND = { io: 'taken', tangled: 'scorn' };

/**
 * Faction plan for a zone: { open, reinf } (faction ids; null = the destination's own).
 * `zoneCount` is the number of zones including the boss. Missions with no plan use the destination's faction throughout.
 */
export function zonePlan(missionId, zi, zoneCount, isBoss) {
  const plan = MISSION_FACTIONS[missionId];
  if (plan) {
    const e = isBoss ? plan[plan.length - 1] : plan[Math.min(zi, plan.length - 2)];
    if (typeof e === 'string') { const f = e.split(':')[1]; return { open: f, reinf: f }; }
    return { open: e[0], reinf: e[1] };
  }
  const taste = MISSION_TASTE[missionId];
  if (taste && !isBoss && zi === zoneCount - 2 && zi > 0) return { open: null, reinf: taste };
  return { open: null, reinf: null };
}

/** Wave faction for activity wave n (1-based): every third wave is the second faction. */
export function activityFaction(locId, n) {
  const f = ACTIVITY_SECOND[locId];
  return f && n % 3 === 0 ? f : null;
}

// ---- skill numbers ----
export const SKILL = {
  blinkTell: 0.35,        // seconds of shimmer before a blink lands
  blinkHitCd: 3.5,        // a hit can trigger a dodge-blink at most this often
  allyShieldHp: 1,        // protected allies take this fraction of nothing while the Goblin lives (see dealDamage)
  summonTell: 0.8,
  reviveWindow: 8,        // a Scorn corpse that has not been burned comes back within this many seconds
  reviveMaxPerZone: 6,    // revivals per zone, so a zone always ends
  reviveBurn: ['burn'],   // a burning corpse is burned beyond recognition and does not revive
  orb: { speed: 9, gravity: 6, fuse: 1.6, radius: 3.4, dmg: 22, color: 0xdfe8ff },
  totemTick: 0.4,
};

/** Blink destination distance and tell are chosen by the unit; this clamps a requested range to its definition. */
export function blinkRange(def, r = Math.random()) {
  const [a, b] = def.blink.range;
  return a + (b - a) * r;
}

/** Whether a corpse may revive: a Scorn unit with the skill, under the zone cap, not burned, not already revived. */
export function mayRevive({ hasSkill, zoneRevives, burned, alreadyRevived }) {
  return !!hasSkill && !burned && !alreadyRevived && zoneRevives < SKILL.reviveMaxPerZone;
}

/** Damage multiplier through a front guard: `facingDot` is the dot of the unit's forward vector and the direction to the attacker. */
export function frontGuardMult(def, facingDot, raw = false) {
  if (raw || !def.frontGuard) return 1;
  return facingDot > 0.45 ? def.frontGuard.mult : 1;
}
