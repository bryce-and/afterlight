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
  // v2.9: the Vex, gold-bronze and cream with a red photoreceptor
  vex: {
    name: 'Vex', short: 'Vex',
    colors: { enemy: 0xd9c9a0, enemy2: 0x6b5232, eye: 0xff4a2a },
    shot: 0xff8a3a,
  },
};
export function isNewFaction(f) { return !!FACTIONS[f]; }

// ---- profiles ----
// Same shape as tiers.js FACTION_PROFILES. Taken blink and weave; Scorn charge, never hide, and rush even alone.
export const NEW_PROFILES = {
  taken: { strafe: 1.2, burstMul: 1, coverMul: 0.6, rushAlone: false, jet: false },
  scorn: { strafe: 0.4, burstMul: 0.8, coverMul: 0, rushAlone: true, jet: false },
  vex: { strafe: 0.6, burstMul: 1, coverMul: 0.4, rushAlone: false, jet: false }, // a steady advance in ranks; they hold ground more than they hide
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
  tk_phalanx:   { faction: 'taken', base: 'heavy', name: 'Taken Phalanx', hp: 760, dmg: 12, burst: 3, burstGap: 0.18, fireCd: [2.4, 3.4], speed: 2.6, skills: ['frontGuard'], frontGuard: { mult: 0.3, box: { x: -0.62, y: 1.2, z: 0.5, w: 0.6, h: 1.2, d: 0.3 }, knock: { range: 4.5, cd: 7, dmg: 14, push: 11 } } },
  tk_knight:    { faction: 'taken', base: 'heavy', name: 'Taken Knight', hp: 860, shield: 220, shieldEl: 'void', skills: ['blink'], blink: { cd: [7, 11], range: [4, 7], toward: false, onHit: true } },
  tk_ogre:      { faction: 'taken', base: 'heavy', name: 'Taken Ogre', hp: 980, shield: 240, shieldEl: 'void', skills: [], enrage: true },
  // ---- Scorn (Fallen raised by Dark Ether) ----
  sc_screeb:    { faction: 'scorn', base: 'suicide', name: 'Screeb', hp: 55, speed: 7.4, blastMul: 1.35 },
  sc_wraith:    { faction: 'scorn', base: 'rusher', name: 'Scorn Wraith', hp: 105, speed: 7.0, meleeDmg: 20, skills: ['revive'], revive: { delay: [4, 6], hpFrac: 0.4 } },
  sc_ravager:   { faction: 'scorn', base: 'rusher', name: 'Scorn Ravager', hp: 300, speed: 5.4, meleeDmg: 34, scale: 1.3, skills: [] },
  sc_stalker:   { faction: 'scorn', base: 'grunt', name: 'Scorn Stalker', hp: 95, skills: ['revive'], revive: { delay: [4, 6], hpFrac: 0.4 } },
  sc_raider:    { faction: 'scorn', base: 'grunt', name: 'Scorn Raider', hp: 110, skills: ['blink', 'revive'], blink: { cd: [5, 8], range: [7, 12], toward: false, onHit: true }, revive: { delay: [4, 6], hpFrac: 0.4 } },
  sc_lurker:    { faction: 'scorn', base: 'grunt', name: 'Scorn Lurker', hp: 150, speed: 3.0, skills: ['frontGuard'], frontGuard: { mult: 0.35, box: { x: -0.6, y: 1.1, z: 0.5, w: 0.7, h: 0.75, d: 0.3 }, knock: null } },
  sc_abomination: { faction: 'scorn', base: 'heavy', name: 'Scorn Abomination', hp: 1000, dmg: 14, burst: 2, burstGap: 0.2, fireCd: [2.2, 3.2], shotColor: 0x5fd3ff, skills: [], enrage: true },
  sc_chieftain: { faction: 'scorn', base: 'captain', name: 'Scorn Chieftain', hp: 340, shield: 160, shieldEl: 'solar', skills: ['totem'], totem: { cd: [14, 19], max: 2, life: 22 } },
  // U15: a story objective target (consoles, totems, emitters): a standing glowing pylon, takes the destination's colors, never moves or shoots
  obj_node:     { base: 'grunt', name: 'Objective Target', hp: 380, speed: 0, static: true, support: true, noDrops: true, objective: true, skills: [] },
  sc_totem:     { faction: 'scorn', base: 'grunt', name: 'Ether Totem', hp: 420, speed: 0, static: true, noDrops: true, support: true, scale: 1.0, skills: ['totemAura'], totemAura: { radius: 11, mult: 0.55 } },
  // ---- v2.9: the Vex (Destiny 2). `fly` lifts a floating unit; `stationary` units never move but still shoot; `lob` fires a mortar arc; `noShield` skips the heavy class shield ----
  vx_goblin:    { faction: 'vex', base: 'grunt', name: 'Goblin', hp: 90, skills: [] },
  vx_fanatic:   { faction: 'vex', base: 'suicide', name: 'Fanatic', hp: 40, speed: 6.6, scale: 0.95, blastMul: 1 },
  vx_hobgoblin: { faction: 'vex', base: 'grunt', name: 'Hobgoblin', hp: 110, range: 42, prefer: 26, speed: 2.8, burst: 1, burstGap: 0.2, fireCd: [2.4, 3.4], dmg: 14, projSpeed: 38, shotSize: 0.13, scale: 1.1, skills: [] },
  vx_harpy:     { faction: 'vex', base: 'grunt', name: 'Harpy', hp: 70, speed: 5.0, prefer: 16, burst: 2, burstGap: 0.12, dmg: 5, scale: 0.9, fly: 2.0, skills: [] },
  vx_supplicant: { faction: 'vex', base: 'suicide', name: 'Supplicant', hp: 40, speed: 7.8, scale: 0.9, fly: 1.6, blastMul: 1 },
  vx_minotaur:  { faction: 'vex', base: 'rusher', name: 'Minotaur', hp: 420, shield: 200, shieldEl: 'void', speed: 5.6, meleeDmg: 30, scale: 1.25, skills: ['blink'], blink: { cd: [4, 7], range: [7, 12], toward: true } },
  vx_wyvern:    { faction: 'vex', base: 'rusher', name: 'Wyvern', hp: 640, shield: 320, shieldEl: 'void', speed: 6.4, meleeDmg: 38, scale: 1.35, fly: 1.2, skills: ['blink'], blink: { cd: [3, 5], range: [8, 13], toward: true } },
  vx_hydra:     { faction: 'vex', base: 'heavy', name: 'Hydra', hp: 820, noShield: true, speed: 2.2, prefer: 12, range: 28, burst: 1, dmg: 22, projSpeed: 20, splash: 2.5, fly: 0.9, skills: ['spinGuard', 'deathBlast'], spinGuard: { arc: 2.6, speed: 1.3, mult: 0.1 }, deathBlast: { radius: 5, dmg: 28 } },
  vx_cyclops:   { faction: 'vex', base: 'heavy', name: 'Cyclops', hp: 1100, noShield: true, stationary: true, lob: true, fly: 2.2, range: 46, prefer: 30, burst: 1, dmg: 30, fireCd: [3.2, 4.4], scale: 1.1, berserk: { below: 0.35, cdMul: 0.3 }, skills: [] },
  vx_imp:       { faction: 'vex', base: 'suicide', name: 'Imp', hp: 14, speed: 8.5, scale: 0.7, fly: 0.8, blastMul: 0.6, noDrops: true },
  vx_imp_swarm: { faction: 'vex', base: 'grunt', name: 'Imp Swarm', hp: 55, speed: 4.6, burst: 2, dmg: 4, fly: 1.2, skills: ['deathSpawn'], deathSpawn: { type: 'vx_imp', n: 5 } },
  // ---- v2.9: Destiny 2 units the older factions were missing ----
  fl_servitor:  { faction: 'scrappers', base: 'grunt', name: 'Servitor', hp: 150, speed: 3.2, prefer: 18, burst: 1, burstGap: 0.2, dmg: 9, projSpeed: 22, fly: 1.8, shotColor: 0xb26bff, skills: ['allyShield', 'blink'], allyShield: { range: 16, retarget: 2.5 }, blink: { cd: [6, 9], range: [6, 10], toward: false, onHit: true } },
  hv_shrieker:  { faction: 'hollow', base: 'grunt', name: 'Shrieker', hp: 360, stationary: true, fly: 1.0, range: 40, prefer: 25, burst: 10, burstGap: 0.09, fireCd: [1.6, 2.4], dmg: 4, projSpeed: 20, shotSize: 0.13, shotColor: 0xb26bff, spiral: { r: 0.12, turn: 0.9 }, skills: [] },
  lg_incendior: { faction: 'legion', base: 'heavy', name: 'Incendior', hp: 560, noShield: true, speed: 2.4, range: 15, prefer: 7, burst: 10, burstGap: 0.07, fireCd: [1.2, 2.0], dmg: 3.5, projSpeed: 17, shotSize: 0.2, splash: 1.5, shotColor: 0xff7a2a, scale: 1.05, skills: ['knockBurst', 'deathBlast'], knockBurst: { range: 4.5, cd: 6, dmg: 12, push: 12 }, deathBlast: { radius: 5, dmg: 40 } },
  lg_gladiator: { faction: 'legion', base: 'rusher', name: 'Gladiator', hp: 700, speed: 6.2, meleeDmg: 40, scale: 1.35, skills: [] },
  tk_incendior: { faction: 'taken', base: 'heavy', name: 'Taken Incendior', hp: 600, noShield: true, speed: 2.4, range: 26, prefer: 14, burst: 1, burstGap: 0.2, fireCd: [2.2, 3.2], dmg: 20, projSpeed: 16, shotSize: 0.3, splash: 3, shotColor: 0xff7a2a, scale: 1.05, skills: ['deathBlast'], deathBlast: { radius: 5, dmg: 40 } },
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
    { t: 'tk_incendior', wave: 1,      n: (zi, g) => (zi >= 1 && g >= 2 ? 1 : 0) },
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
  vex: [
    { t: 'vx_goblin',     wave: 'both', n: (zi, g) => 3 + Math.floor(g / 3) },
    { t: 'vx_fanatic',    wave: 0,      n: (zi, g) => (zi > 0 ? 1 : 0) + Math.floor(g / 8) },
    { t: 'vx_hobgoblin',  wave: 0,      n: (zi, g) => 1 + (zi > 0 ? 1 : 0) },
    { t: 'vx_harpy',      wave: 'both', n: (zi, g) => (zi >= 1 || g >= 1 ? 1 + Math.floor(g / 5) : 0) },
    { t: 'vx_supplicant', wave: 1,      n: (zi, g) => (zi >= 1 ? 1 : 0) },
    { t: 'vx_imp_swarm',  wave: 1,      n: (zi, g) => (zi >= 1 && g >= 1 ? 1 : 0) },
    { t: 'vx_cyclops',    wave: 0,      n: (zi, g) => (zi >= 1 && g >= 1 ? 1 : 0) },
    { t: 'vx_minotaur',   wave: 1,      n: (zi, g) => (zi >= 1 || g >= 2 ? 1 : 0) },
    { t: 'vx_hydra',      wave: 1,      n: (zi, g) => (zi >= 1 && g >= 2 ? 1 : 0) },
    { t: 'vx_wyvern',     wave: 1,      n: (zi, g) => (zi >= 2 && g >= 3 ? 1 : 0) },
  ],
};
// v2.9: the Destiny 2 units added to the three older factions, mixed into their ordinary waves (game.js baseWaves). Keyed by the destination's own faction.
export const BASE_EXTRAS = {
  scrappers: [{ t: 'fl_servitor', wave: 1, n: (zi, g) => (zi >= 1 && g >= 1 ? 1 : 0) }],
  hollow: [{ t: 'hv_shrieker', wave: 0, n: (zi, g) => (zi >= 1 ? 1 + (g >= 4 ? 1 : 0) : 0) }],
  legion: [
    { t: 'lg_incendior', wave: 1, n: (zi, g) => (zi >= 1 && g >= 1 ? 1 : 0) },
    { t: 'lg_gladiator', wave: 1, n: (zi, g) => (zi >= 1 && g >= 2 ? 1 : 0) },
  ],
};
/** Each destination's own enemy faction. */
export const LOC_FACTION = { earth: 'scrappers', moon: 'hollow', mars: 'legion', titan: 'hollow', tangled: 'scrappers', io: 'legion', dc: 'hollow', leviathan: 'legion' };
/** Extra unit ids for a wave of an ordinary destination wave (`waveIdx` 0 or 1+). */
export function baseExtras(locId, waveIdx, zi, g, more = 1) {
  const out = [];
  for (const r of BASE_EXTRAS[LOC_FACTION[locId]] || []) {
    if (r.wave !== (waveIdx === 0 ? 0 : 1)) continue;
    for (let i = 0, n = Math.round(r.n(zi, g) * more); i < n; i++) out.push(r.t);
  }
  return out;
}

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
  // U15: the Dreaming City is Taken throughout; the Leviathan is Loyalist Cabal, and the Taken stalk the Royal Pools (zone 2)
  dc1: [['taken', 'taken'], 'boss:taken'],
  dc2: [['taken', 'taken'], 'boss:taken'],
  dc3: [['taken', 'taken'], 'boss:taken'],
  // v2.9: the Pyramidion is Vex all the way down; its Mind keeps the last chamber
  io3: [['vex', 'vex'], ['vex', 'vex'], [null, 'vex'], 'boss:vex'],
  lev1: [[null, null], [null, null], ['taken', 'taken'], [null, null], [null, null]],
};
// Missions that only brush the second faction: a lone reinforcement wave in the deepest zone before the boss.
export const MISSION_TASTE = { io2: 'taken', ts2: 'scorn' };
// Wave activities (Horde/Endless) bring the destination's second faction every third wave.
export const ACTIVITY_SECOND = { io: 'vex', tangled: 'scorn', dc: 'taken' };

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

/** Damage multiplier through a guard shield. (lx, ly, lz) is the hit point in the unit's own space (x right, y up from the feet, z forward, before its scale);
 *  only a hit inside the shield's box `def.frontGuard.box` is reduced, so the rest of the body takes full damage. */
export function guardMult(def, lx, ly, lz, raw = false) {
  const g = def.frontGuard;
  if (raw || !g) return 1;
  const b = g.box;
  return Math.abs(lx - b.x) <= b.w / 2 && Math.abs(ly - b.y) <= b.h / 2 && Math.abs(lz - b.z) <= b.d / 2 ? g.mult : 1;
}

/** Does a Hydra's rotating shield stop a shot? `angle` is the shield's centre bearing (radians, world) and `bearing` the direction of the shooter from the unit. */
export function spinBlocks(def, angle, bearing) {
  const g = def.spinGuard;
  if (!g) return false;
  let d = bearing - angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d) < g.arc / 2;
}
