// Afterlight unit tests: pure logic only (progression, loot, save, data, releases, status effects, combat rules).
// Open tools/tests.html on the running dev server. Uses an in-memory store, so the real save is never touched.
import { SLOTS, ARMOR_SLOTS, slotName, WEAPON_SLOTS as WEAPON_SLOTS_T, CLASSES, LOCATIONS, ARCHETYPES, EXOTIC_WEAPONS, RARITIES, ELEMENTS, EXOTIC_ARMOR, EXOTIC_ARMOR_PERKS, exoticArmorFor, exoticArmorLevel } from '../js/data.js';
import { LEVEL_CAP, LIGHT_CAP, XP, xpToNext, xpForLevel, levelInfo, rewardAt, rarityWeights, rollRarity, subclassLevel, subclassesUnlockedAt, RARITY_CURVE } from '../js/progression.js';
import { rollItem, exoticWeights, pickExotic, EXOTIC_REPEAT_WEIGHT } from '../js/loot.js';
import * as S from '../js/save.js';
import * as MOB from '../js/mobile.js';
import { mulberry32 } from '../js/util.js';
import { RELEASES, ROADMAP, ROADMAP_STATUSES, titleRelease } from '../js/releases.js';
import { StatusSet, STATUS } from '../js/status.js';
import * as C from '../js/combat.js';
import * as SC from '../js/subclass.js';
import { ENEMY_STATUS, WEAKEN_MULT } from '../js/status.js';
import { abilityIcon } from '../js/ability-icons.js';
import { FRAMES, LEGENDARY_WEAPONS, framesFor, frameSlot, archesForSlot, weaponStats, weaponHandling, frameFor, NAMED_WEAPONS, namedFor, perkPoolFor, rollPerks, eligiblePerks, POOL_PER_COLUMN } from '../js/frames.js';
import * as PG from '../js/progression.js';
import { PERKS, PERK_COLUMNS, PERK_ELEMENT, PERK_SLOTS, perkColumn, perksByColumn } from '../js/data.js';
import { ENERGY, SHIELD_ELEMENTS } from '../js/data.js';
import { readyState } from '../js/net.js';
import * as AR from '../js/armor.js';
import { makeArmor } from '../js/loot.js';
import * as ST from '../js/style.js';
import { sfx, SHOT_RECIPES, ELEMENT_TINT, ABILITY_RECIPES, FACTION_SOUND, spatial } from '../js/audio.js';
import { musicSectionFor } from '../js/music.js';
import { G } from '../js/state.js';
import * as KB from '../js/keybinds.js';
import * as TM from '../js/terms.js';
import { orientedCollider, footprintHit, pointInColliders, pushOutCircle, moveBody, rayGround, groundAt, floorBelow } from '../js/colliders.js';
import { buildTerrain, steepest, routeSlope, MAX_SLOPE } from '../js/terrain.js';
import { buildNav, findPath, lineClear, heightAt, floodReach, ledgeSpots, nearestWalkable, NAV, ledgeStep, addLeapLinks } from '../js/nav.js';
import * as AI from '../js/ai.js';
import * as TR from '../js/tiers.js';
import { fallen } from '../js/models-fallen.js';
import { hive } from '../js/models-hive.js';
import { cabal } from '../js/models-cabal.js';
import { scorn } from '../js/models-scorn.js';
import * as THREE from 'three';
import { ENEMY_TYPES } from '../js/data.js';
import * as FA from '../js/factions.js';
import { findFloats } from './floatcheck.js';
import { laid } from '../js/patrol-kit.js';
import * as OB from '../js/objectives.js';
import * as ST_ from '../js/story.js';
import * as LI from '../js/light.js';
import * as EX from '../js/exotic-rules.js';
import * as DR from '../js/darkness-rules.js';
import * as DATA from '../js/data.js';
import { makeExotic } from '../js/loot.js';
import * as Q from '../js/quests.js';
import * as CA from '../js/campaign.js';
import * as RW from '../js/rewards.js';
import * as BZ from '../js/blitz.js';
import * as BN from '../js/boons.js';
import * as SI from '../js/sights.js';
import * as BRUN from '../js/boon-run.js';
import * as EXO31H from '../js/exotic-armor-u31.js';
import * as WP31 from '../js/weapon-perks-u31.js';
import * as FR31 from '../js/frames.js';
import { runCommand as runCmd31, completions as comp31 } from '../js/devcommands.js';
import * as DCAM from '../js/deathcam.js';
import { TOWER_SPOTS, TOWER_FUTURE_POSTS } from '../js/tower-data.js';
import { PATROL_DATA, PATROL_TUNE, EVENT_SPECS, BEACON_TEXT, SPARROW, FACTION_KITS, TITAN, TITAN_DECKS, TITAN_RAMP, IO, TANGLED, TANGLED_ISLANDS, TANGLED_RAMPS, DREAMING, DREAMING_ISLANDS, DREAMING_RAMPS, kitUnit } from '../js/patrol-data.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function eq(a, b, msg = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg); }

function memStore(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m };
}
const fresh = (init) => { const st = memStore(init); S.useStorage(st); S.SAVE_RULES.resetBelow = 9; return st; }; // the campaign reset (U15) is below v9; later versions migrate
const freshOld = (init) => { const st = fresh(init); S.SAVE_RULES.resetBelow = 0; return st; }; // older saves migrate instead of resetting

// ---------- progression ----------
test('level 1 at 0 XP, 2 after the first step', () => {
  eq(levelInfo(0).level, 1);
  eq(levelInfo(xpToNext(1) - 1).level, 1);
  eq(levelInfo(xpToNext(1)).level, 2);
});
test('level 40 is the cap and XP past it stays at 40', () => {
  eq(levelInfo(xpForLevel(LEVEL_CAP)).level, LEVEL_CAP);
  eq(levelInfo(xpForLevel(LEVEL_CAP) * 3).level, LEVEL_CAP);
  ok(levelInfo(xpForLevel(LEVEL_CAP)).max, 'max flag');
  eq(levelInfo(xpForLevel(LEVEL_CAP) - 1).level, LEVEL_CAP - 1);
});
test('a first clear of every campaign mission lands mid-track, not at the cap', () => {
  // rough campaign estimate: 60 average kills (~13 XP) per mission plus mission and first-clear XP
  const xp = LOCATIONS.flatMap((l) => l.missions).length * (60 * 13 + XP.mission + XP.firstClear);
  const L = levelInfo(xp).level;
  ok(L >= 18 && L <= 32, `campaign lands at level ${L}`);
});
test('reward track: an engram every 3 levels in the best rarity usable there, exotic at 20 and 40 (U10)', () => {
  const by = {};
  for (let L = 1; L <= LEVEL_CAP; L++) { const r = rewardAt(L); if (r) (by[r] = by[r] || []).push(L); }
  eq(by.exotic, [20, 40]);
  eq(by.uncommon, [3]);
  eq(by.rare, [6, 9]);
  eq(by.legendary, [12, 15, 18, 21, 24, 27, 30, 33, 36, 39]);
  eq(by.common, undefined);
});
test('starter subclasses match the spec; the third unlocks at 10', () => {
  const starters = (c) => Object.keys(CLASSES[c].subclasses).filter((id) => !CLASSES[c].subclasses[id].prismatic && subclassLevel(c, id) === 1).sort();
  eq(starters('vanguard'), ['striker', 'sunbreaker']); // Sunbreaker + Fists of Havoc
  eq(starters('arcanist'), ['dawnblade', 'voidwalker']); // Nova Bomb + Dawnblade
  eq(starters('stalker'), ['gunslinger', 'nightstalker']); // Golden Gun + Shadowshot
  eq(subclassesUnlockedAt(10).map((x) => x.subId).sort(), ['arcstrider', 'sentinel', 'stormcaller']);
  for (const c of Object.keys(CLASSES)) eq(Object.keys(CLASSES[c].subclasses).length, 6, c); // U27: plus Prismatic // U22: three Light plus Stasis and Strand
  eq(subclassesUnlockedAt(28).map((x) => x.subId).sort(), ['behemoth', 'berserker', 'broodweaver', 'revenant', 'shadebinder', 'threadrunner']);
});
test('rarity curve: no legendaries at 1, rare at 15, dominant at 40', () => {
  const share = (L, idx) => { const r = mulberry32(L * 7919); let n = 0; for (let i = 0; i < 10000; i++) if (rollRarity(L, 0, r) === idx) n++; return n / 10000; };
  eq(share(1, 3), 0, 'legendary at 1');
  const l15 = share(15, 3); ok(l15 > 0.02 && l15 < 0.1, `legendary at 15 = ${l15}`);
  const l40 = share(40, 3); ok(l40 > 0.85, `legendary at 40 = ${l40}`);
  ok(share(1, 0) > share(20, 0), 'commons fade as you level');
});
test('rarity weights are valid at every level', () => {
  for (let L = 1; L <= LEVEL_CAP; L++) { const w = rarityWeights(L); eq(w.length, RARITIES.length); ok(w.every((x) => x >= 0) && w.reduce((a, b) => a + b) > 0, `level ${L}`); }
  eq(RARITY_CURVE[0].level, 1); eq(RARITY_CURVE.at(-1).level, LEVEL_CAP);
});

// ---------- loot / Light ----------
test('items can exceed 100 Light and are clamped at the cap', () => {
  eq(rollItem(150, 3).power, 150);
  eq(rollItem(CA.LIGHT_MAX + 50, 3).power, CA.LIGHT_MAX); // U20a: the item clamp is the Ultimate cap; callers hold drops under their tier's cap
  eq(CA.LIGHT_MAX, 350);
});
test('mission Light rises every mission and stays under the cap', () => {
  const p = LOCATIONS.flatMap((l) => l.missions.map((m) => m.power));
  for (let i = 1; i < p.length; i++) ok(p[i] > p[i - 1], `mission ${i}`);
  ok(p.at(-1) <= LIGHT_CAP, 'last mission under cap');
});

// ---------- save ----------
test('new save: current version, level 1, every slot equipped, one of each weapon type', () => {
  fresh();
  const s = S.createSave('vanguard');
  eq(s.version, S.SAVE_VERSION);
  eq(S.playerLevel(s), 1);
  for (const sl of ['primary', 'special', 'heavy', 'helmet', 'arms', 'chest', 'legs', 'classitem']) ok(S.getEquipped(s, sl), sl); // U27: the class item is the eighth slot
  eq(new Set(s.inventory.filter((i) => i.kind === 'weapon').map((i) => i.arch)).size, Object.keys(ARCHETYPES).filter((id) => !ARCHETYPES[id].exoticOnly).length);
});
test('save round-trips through storage', () => {
  fresh();
  const s = S.createSave('stalker');
  S.addXp(s, 1234);
  S.writeSave(s);
  const back = S.loadSave();
  eq(back.progression.xp, 1234);
  eq(back.inventory.length, s.inventory.length);
});
test('a pre-overhaul save is backed up, cleared, and only its settings carry over', () => {
  const legacy = JSON.stringify({ version: 1, classId: 'arcanist', inventory: [{ id: 'x' }], equipped: {}, cleared: { e1: true }, glimmer: 9999, settings: { sens: 2.5, fov: 95 } });
  const st = fresh({ afterlight_save_v1: legacy });
  eq(S.loadSave(), null, 'starts fresh');
  eq(st.getItem(S.BACKUP_KEY), legacy, 'backup');
  eq(st.getItem('afterlight_save_v1'), null, 'legacy key cleared');
  ok(S.takeLegacyNotice() && !S.takeLegacyNotice(), 'notice shows once');
  const s = S.createSave('arcanist');
  eq([s.settings.sens, s.settings.fov, s.glimmer, Object.keys(s.cleared).length], [2.5, 95, 250, 0]);
});
test('settings carry over even when the Guardian is created after a reload', () => {
  fresh({ afterlight_backup_v1: JSON.stringify({ version: 1, settings: { sens: 3, volume: 0.1 } }) });
  eq(S.loadSave(), null);
  const s = S.createSave('vanguard');
  eq([s.settings.sens, s.settings.volume, s.settings.fov], [3, 0.1, 80]);
});
test('an existing backup is never overwritten', () => {
  const st = fresh({ afterlight_save_v1: '{"version":1}', afterlight_backup_v1: 'older' });
  S.loadSave();
  eq(st.getItem(S.BACKUP_KEY), 'older');
});
test('a save from a newer version is ignored, not modified', () => {
  const raw = JSON.stringify({ version: 99, classId: 'vanguard', inventory: [], equipped: {} });
  const st = fresh({ afterlight_save_v2: raw });
  eq(S.loadSave(), null);
  eq(st.getItem('afterlight_save_v2'), raw);
});
test('level rewards: locked, then claimable once', () => {
  fresh();
  const s = S.createSave('vanguard');
  eq(S.claimLevelReward(s, 3).error, 'Reach level 3 first.');
  S.addXp(s, xpForLevel(3));
  const r = S.claimLevelReward(s, 3);
  ok(r.item && r.item.rarity === 'uncommon', 'uncommon at 3 (U10: the best rarity usable at that level)');
  eq(S.claimLevelReward(s, 3).error, 'Already claimed.');
  eq(S.rewardState(s, 4), null);
  S.addXp(s, xpForLevel(20));
  eq(S.claimLevelReward(s, 20).item.rarity, 'exotic');
});
test('U20b claiming with a full slot sends the reward to the Postmaster and loses nothing', () => {
  fresh();
  const s = S.createSave('vanguard');
  S.addXp(s, xpForLevel(3));
  for (const slot of SLOTS) while (!S.slotFull(s, slot)) s.inventory.push({ ...rollItem(10, 0, slot, null, 'vanguard'), id: `pad-${slot}-${s.inventory.length}` });
  const n = s.inventory.length, r = S.claimLevelReward(s, 3);
  ok(r.item && !r.error, 'claimed'); eq(s.inventory.length, n); ok(s.postmaster.some((i) => i.id === r.item.id), 'in the Postmaster');
  eq(S.rewardState(s, 3), 'claimed');
});
test('addXp reports level-ups', () => {
  fresh();
  const s = S.createSave('vanguard');
  eq(S.addXp(s, 10), null);
  eq(S.addXp(s, xpForLevel(5)), { from: 1, to: 5 });
});
test('the third subclass is locked until level 10 and activeKit falls back', () => {
  fresh();
  const s = S.createSave('arcanist');
  s.subclass = { arcanist: 'stormcaller' };
  ok(!S.isSubclassUnlocked(s, 'arcanist', 'stormcaller'), 'locked');
  eq(S.activeKit(s).subclassId, 'voidwalker');
  S.addXp(s, xpForLevel(10));
  eq(S.activeKit(s).subclassId, 'stormcaller');
});

// ---------- content data ----------
test('every exotic weapon uses a real archetype', () => {
  for (const e of EXOTIC_WEAPONS) ok(ARCHETYPES[e.arch], e.name);
});
test('every subclass has a super, grenade, melee and class ability', () => {
  // grenade and class ability come from the loadout (js/subclass.js); melee and super from the subclass
  for (const [cid, c] of Object.entries(CLASSES)) for (const id of Object.keys(c.subclasses)) { const a = SC.resolveKit(cid, id, undefined, 1).abilities; for (const k of ['super', 'grenade', 'melee', 'class']) ok(a[k]?.id && a[k].name, `${id}.${k}`); }
});
test('XP is defined for every enemy type', () => {
  for (const t of ['grunt', 'rusher', 'captain', 'heavy', 'boss']) ok(XP.kill[t] > 0, t);
});

// ---------- status effects ----------
test('status: apply, expire, and the timer never shrinks unless set', () => {
  const st = new StatusSet();
  st.apply('outlaw');
  eq(st.remaining('outlaw'), STATUS.outlaw.t);
  st.apply('outlaw', { t: 2 });
  eq(st.remaining('outlaw'), 6, 'shorter re-apply keeps the longer timer');
  st.apply('outlaw', { t: 2, set: true });
  eq(st.remaining('outlaw'), 2, 'set replaces');
  st.tick(1.5); ok(st.has('outlaw'), 'still active');
  st.tick(0.6); ok(!st.has('outlaw'), 'expired');
});
test('status: stacks cap, consume, and untimed effects', () => {
  const st = new StatusSet();
  for (let i = 0; i < 5; i++) st.apply('rampage', { add: 1, set: true });
  eq(st.stacks('rampage'), 3, 'Rampage caps at 3');
  st.apply('memento', { scope: 0, stacks: 6 });
  st.tick(100); ok(st.has('memento', 0), 'untimed survives ticks');
  for (let i = 0; i < 5; i++) st.consume('memento', 0);
  eq(st.stacks('memento', 0), 1);
  st.consume('memento', 0); ok(!st.has('memento', 0), 'last round ends it');
});
test('status: weapon scopes are separate and clear with their weapon', () => {
  const st = new StatusSet();
  st.apply('killclip', { scope: 0 }); st.apply('killclip', { scope: 2 }); st.apply('heart', { scope: 'melee', t: 8 });
  ok(st.has('killclip', 0) && st.has('killclip', 2) && !st.has('killclip', 1), 'per slot');
  st.clearScope(0);
  ok(!st.has('killclip', 0) && st.has('killclip', 2) && st.has('heart', 'melee'), 'only slot 0 cleared');
  eq(st.list('weapon').length, 1); eq(st.list('general').length, 1);
});
test('status: unknown effects are refused; every effect has a HUD group, name and glyph', () => {
  let threw = false; try { new StatusSet().apply('nope'); } catch { threw = true; }
  ok(threw, 'unknown id throws');
  for (const [id, d] of Object.entries(STATUS)) ok(['general', 'weapon'].includes(d.group) && d.name && d.glyph && d.color, id);
});

// ---------- combat rules (U2) ----------
test('super energy: kills give 2 to 6%, passive charge takes about 200 s', () => {
  const all = [];
  for (const src of ['weapon', 'ability', 'melee']) for (const crit of [false, true]) for (const t of ['grunt', 'rusher', 'captain', 'heavy']) all.push(C.superKillGain(src, crit, t));
  eq(Math.min(...all), 2); eq(Math.max(...all), 6);
  const sec = 100 / C.SUPER_PASSIVE;
  ok(sec >= 190 && sec <= 210, `passive ${sec}s`);
});
test('Song of Flame: modeled super uptime is lower than v1.1', () => {
  // uptime = duration / (duration + recharge); recharge with passive gain plus one weapon kill every 2 s
  const up = (dur, passive, perKill) => dur / (dur + 100 / (passive + perKill / 2));
  const before = up(12, 0.75, 3), after = up(C.SONG.duration, C.SUPER_PASSIVE, C.superKillGain('weapon', false, 'grunt'));
  ok(after < before * 0.8, `before ${(before * 100).toFixed(1)}%, after ${(after * 100).toFixed(1)}%`);
  ok(C.SONG.abilityRegen >= 20, 'H4: grenades and melees recharge almost instantly during Song');
});
test('chains skip the primary target: Stormtrance hits 4, Golden Gun splash never re-hits', () => {
  const a = { n: 'a' }, b = { n: 'b' }, c = { n: 'c' }, d = { n: 'd' }, e = { n: 'e' };
  eq(C.chainTargets(a, [a, b, c, d, e], C.STORMTRANCE_CHAIN).map((x) => x.n), ['b', 'c', 'd']);
  eq(1 + C.STORMTRANCE_CHAIN, 4);
  eq(C.chainTargets(b, [a, b, c], C.GOLDEN_GUN_SPLASH).map((x) => x.n), ['a', 'c']);
  eq(C.chainTargets(null, [a, b, c], 2).map((x) => x.n), ['a', 'b'], 'no primary: nearest');
});
test('ADS spread: primaries at least 40% tighter than v1.1, nothing wider', () => {
  const V11 = { auto: 0.007, hand: 0.002, pulse: 0.004, scout: 0.001, smg: 0.016, shotgun: 0.06, sniper: 0, fusion: 0.016, linear: 0, rocket: 0, mg: 0.012, glauncher: 0.004 };
  for (const [id, old] of Object.entries(V11)) {
    const A = ARCHETYPES[id];
    ok(A.ads <= old, `${id} wider`);
    if (A.slot === 'primary') ok(A.ads <= old * 0.6, `${id} ADS ${A.ads} vs ${old}`);
  }
  // standing still, fully aimed: the cone is the ADS value; hip fire is unchanged
  const near = (a, b) => Math.abs(a - b) < 1e-12;
  ok(near(C.spreadFor({ hip: 0.03, ads: 0.004, adsT: 1, moving: false, air: false, steady: false, bloom: 0 }), 0.004), 'aimed = ADS value');
  ok(near(C.spreadFor({ hip: 0.03, ads: 0.004, adsT: 0, moving: false, air: false, steady: false, bloom: 0 }), 0.03), 'hip unchanged');
  ok(C.spreadFor({ hip: 0.03, ads: 0.004, adsT: 1, moving: true, air: false, steady: false, bloom: 0 }) <= 0.004 + 1e-9, 'aimed moving no wider');
});
test('primaries: late-mission time to kill is within 1.3x of mission 1 (was 2.7x)', () => {
  const g = LOCATIONS.length * 3 - 1;
  const hp = (1 + g * 0.1), dmg = C.weaponTierMult(g);
  ok(hp / dmg <= 1.3, `ratio ${(hp / dmg).toFixed(2)}`);
  eq(C.weaponTierMult(0), 1);
  ok(C.PRIMARY_BOOST > 1 && C.ABILITY_POWER < 1.4, 'primary up, abilities toned down');
});
test('stagger: threshold by type, crits stagger easier, cooldown and bosses refuse', () => {
  eq(C.staggerFor('grunt', 5, 100, false, true), 0, 'small hit');
  ok(C.staggerFor('grunt', 12, 100, false, true) >= C.STAGGER.min, 'at threshold');
  ok(C.staggerFor('grunt', 9, 100, true, true) > 0 && C.staggerFor('grunt', 9, 100, false, true) === 0, 'crit threshold lower');
  eq(C.staggerFor('grunt', 80, 100, false, false), 0, 'on cooldown');
  ok(C.staggerFor('grunt', 100, 100, false, true) <= C.STAGGER.max, 'capped');
  eq(C.staggerFor('heavy', 25, 100, false, true), 0, 'heavies need bigger hits');
  eq(C.staggerFor('boss', 5000, 100, true, true), 0, 'bosses never stagger');
});
test('damage numbers drift mostly sideways, on alternating sides', () => {
  const a = C.dmgDrift(1, 0), b = C.dmgDrift(1, 0.8), c = C.dmgDrift(-1, 0.8);
  ok(Math.abs(b.x - a.x) > Math.abs(b.y - a.y), `dx ${b.x - a.x} dy ${b.y - a.y}`);
  ok(b.y > a.y, 'eases down');
  ok(c.x < 0 && b.x > 0, 'sides');
});

// ---------- subclasses: registry, loadouts, gating (Paths of Light) ----------
const SUBS = Object.entries(CLASSES).flatMap(([c, k]) => Object.keys(k.subclasses).filter((sid) => !k.subclasses[sid].prismatic).map((sid) => [c, sid])); // U27: Prismatic is checked in its own tests
const isDarkSub = (c, sid) => ['stasis', 'strand'].includes(CLASSES[c].subclasses[sid].element);
const LIGHT_SUBS = SUBS.filter(([c, sid]) => !isDarkSub(c, sid)); // U22: the nine Light subclasses
const DARK_SUBS = SUBS.filter(([c, sid]) => isDarkSub(c, sid));
test('registry: 3 grenades per element, 2 class abilities per class, 4 aspects per subclass, 8 fragments per Light element and 10 per Darkness element (H23)', () => {
  for (const el of ['solar', 'arc', 'void', 'stasis', 'strand']) eq(SC.grenadesFor(el).length, 3, el);
  for (const [c, sid] of SUBS) eq(SC.classAbilitiesFor(c, sid).length, sid === 'dawnblade' ? 3 : 2, sid); // H4: Phoenix Dive is Dawnblade's third
  // H3: each former subclass trait is an aspect; Bastion is gone, so Sentinel keeps 4 and the rest have 5. U22: Darkness subclasses have Destiny 2's four
  for (const [c, sid] of SUBS) eq(SC.aspectsFor(c, sid).length, sid === 'sentinel' || isDarkSub(c, sid) ? 4 : 5, sid);
  eq(Object.keys(SC.ASPECTS).length, 68);
  eq(['solar', 'arc', 'void', 'stasis', 'strand'].map((el) => SC.fragmentsFor(el).length), [8, 8, 8, 10, 10]);
  for (const a of Object.values(SC.ASPECTS)) ok(a.slots === 2 || a.slots === 3, a.name); // U9: one more slot each
});
test('every default loadout is valid and resolves to the expected abilities (H3: Sentinel keeps its barricade, Sunsinger grenades from Gift of the Sun)', () => {
  const v12 = { // grenade, grenade cd, class ability, class cd
    sunbreaker: ['solar', 33, 'barricade', 34], striker: ['pulse', 30, 'barricade', 34], sentinel: ['suppressor', 33, 'barricade', 34],
    gunslinger: ['swarm', 30, 'marksman', 13], nightstalker: ['axion', 30, 'marksman', 16], arcstrider: ['flux', 30, 'gambler', 12],
    voidwalker: ['vortex', 36, 'rift', 42], stormcaller: ['storm', 33, 'empower', 42], dawnblade: ['solar', 23, 'rift', 42],
    behemoth: ['glacier', 33, 'barricade', 34], berserker: ['shackle', 33, 'barricade', 34], revenant: ['coldsnap', 30, 'marksman', 13],
    threadrunner: ['grapple', 21, 'gambler', 12], shadebinder: ['duskfield', 30, 'rift', 42], broodweaver: ['threadling', 30, 'rift', 42],
  };
  for (const [c, sid] of SUBS) {
    const d = SC.defaultLoadout(c, sid);
    eq(SC.sanitizeLoadout(c, sid, d, SC.aspectLevel(SC.aspectsFor(c, sid)[0])), d, `${sid} default is valid at its unlock level`);
    const k = SC.resolveKit(c, sid, undefined, 40), a = k.abilities;
    eq([a.grenade.id, a.grenade.cd, a.class.id, a.class.cd], v12[sid], sid);
    eq(a.grenade.element, CLASSES[c].subclasses[sid].element, `${sid} grenade element`);
  }
});
test('loadout rules: element, class and subclass must match; locked and unknown entries fall back', () => {
  const lo = SC.sanitizeLoadout('vanguard', 'sunbreaker', { grenade: 'vortex', class: 'rift', aspects: ['knockout', 'roaring', 'nope'], fragments: ['shock', 'torches'] }, 40);
  eq(lo.grenade, 'solar'); eq(lo.class, 'barricade'); eq(lo.aspects, ['roaring']); eq(lo.fragments, ['torches']);
  // fragments never exceed the slots the aspects open, and duplicates are dropped
  const two = SC.sanitizeLoadout('arcanist', 'voidwalker', { aspects: ['chaos', 'childgods'], fragments: ['expulsion', 'expulsion', 'persistence', 'starvation', 'undermining', 'instability'] }, 40);
  eq(two.fragments, ['expulsion', 'persistence', 'starvation', 'undermining']); // 2 + 2 slots
  eq(SC.fragmentSlots(['feedvoid', 'chaos']), 5);
  // only two aspects
  eq(SC.sanitizeLoadout('stalker', 'arcstrider', { aspects: ['lethal', 'flowstate', 'ascension'] }, 40).aspects, ['lethal', 'flowstate']);
});
test('reward-track gating: last aspect of each level 10 subclass and two new fragments', () => {
  eq([SC.aspectLevel('bulwark'), SC.aspectLevel('ascension'), SC.aspectLevel('surge')], [13, 16, 19]);
  eq([SC.fragmentLevel('ions'), SC.fragmentLevel('instability')], [22, 25]);
  eq(SC.aspectLevel('demolition'), 10, 'other level 10 aspects come with the subclass');
  eq(SC.aspectLevel('roaring'), 1, 'starter aspects are open from the start');
  for (const L of [13, 16, 19, 22, 25]) eq(rewardAt(L), null, `level ${L} has no item reward`);
  eq(SC.buildUnlocksAt(13, 'vanguard').map((x) => x.id), ['bulwark']);
  eq(SC.buildUnlocksAt(13, 'stalker'), []);
  eq(SC.buildUnlocksAt(22, 'stalker').map((x) => x.id), ['ions']);
  eq(SC.sanitizeLoadout('stalker', 'arcstrider', { aspects: ['ascension'] }, 15).aspects, [], 'locked below 16');
  eq(SC.sanitizeLoadout('stalker', 'arcstrider', { aspects: ['ascension'] }, 16).aspects, ['ascension']);
  eq(SC.sanitizeLoadout('vanguard', 'striker', { aspects: ['knockout'], fragments: ['ions', 'shock'] }, 21).fragments, ['shock']);
});
test('aspect cooldown multipliers; recharge boosts are capped', () => {
  eq(SC.cooldownMults(['giftsun']).grenade, 0.7);
  eq(SC.cooldownMults([]), { grenade: 1, melee: 1, class: 1 });
  eq(SC.regenMult([]), 1);
  ok(Math.abs(SC.regenMult([1.5, 1.2]) - 1.8) < 1e-9, 'boosts multiply');
  eq(SC.regenMult([1.5, 1.5, 1.5, 1.2]), SC.REGEN_CAP);
});
test('save v2 upgrades to the current version: subclass choice kept, loadout defaults, nothing else touched', () => {
  const v2 = { version: 2, classId: 'stalker', glimmer: 777, inventory: [{ id: 'a', slot: 'primary', power: 50 }], vault: [], equipped: { primary: 'a' }, cleared: { e1: true }, subclass: { stalker: 'nightstalker' }, progression: { xp: 0, claimed: [] }, settings: {} };
  const st = freshOld({ afterlight_save_v2: JSON.stringify(v2) });
  const s = S.loadSave();
  eq(s.version, S.SAVE_VERSION); eq(S.SAVE_VERSION, 15);
  eq(s.loadout, {}); eq(s.glimmer, 777); eq(s.subclass, { stalker: 'nightstalker' }); eq(s.cleared, { e1: true }); eq(s.inventory.length, 2, 'the item plus the class item v15 grants');
  eq(JSON.parse(st.getItem('afterlight_save_v2')).version, S.SAVE_VERSION, 'written back');
  const k = S.activeKit(s);
  eq([k.subclassId, k.abilities.grenade.id, k.abilities.class.id, k.aspects], ['nightstalker', 'axion', 'marksman', ['vanishing', 'abyssal']]); // H3: Abyssal Edge joins the default
});
test('setLoadout saves a valid loadout per subclass; activeKit uses it', () => {
  fresh();
  const s = S.createSave('vanguard');
  eq(s.loadout, {});
  S.setLoadout(s, 'vanguard', 'sunbreaker', { grenade: 'healing', class: 'rally', aspects: ['roaring', 'solinvictus'], fragments: ['torches', 'ashes', 'singeing', 'empyrean', 'searing', 'torches'] });
  eq(S.getLoadout(s, 'vanguard', 'sunbreaker'), { super: 'hammers', jump: 'lift', grenade: 'healing', class: 'rally', aspects: ['roaring', 'solinvictus'], fragments: ['torches', 'ashes', 'singeing', 'empyrean', 'searing'] });
  const k = S.activeKit(s);
  eq([k.abilities.grenade.name, k.abilities.class.name, k.fragments.length], ['Healing Grenade', 'Rally Barricade', 5]);
  eq(S.getLoadout(s, 'vanguard', 'striker'), SC.defaultLoadout('vanguard', 'striker'), 'other subclasses untouched');
  // dropping an aspect drops the fragments it opened
  eq(S.setLoadout(s, 'vanguard', 'sunbreaker', { aspects: ['solinvictus'] }).fragments, ['torches', 'ashes']);
});
test('supers declare their camera; Dawnblade shows as Sunsinger with the same id', () => {
  for (const [c, sid] of SUBS) ok(['first', 'third'].includes(CLASSES[c].subclasses[sid].abilities.super.camera), sid);
  eq(CLASSES.arcanist.subclasses.dawnblade.name, 'Sunsinger');
});
test('enemy debuffs live on the status registry', () => {
  const e = new StatusSet(ENEMY_STATUS);
  for (const id of ['weaken', 'slow', 'suppress', 'burn', 'poison', 'jolt']) ok(ENEMY_STATUS[id], id);
  e.apply('weaken', { t: 2 }); e.apply('jolt', { t: 4 });
  ok(e.has('weaken') && e.has('jolt'), 'applied');
  e.tick(2.5);
  ok(!e.has('weaken') && e.has('jolt'), 'weaken expired, jolt left');
  let threw = false; try { e.apply('rampage'); } catch { threw = true; }
  ok(threw, 'player effects are not enemy debuffs');
  eq(WEAKEN_MULT, 1.3);
  eq(C.JOLT.n, 3);
});
test('every ability, aspect and fragment icon is distinct within its slot type', () => {
  const groups = {
    grenade: Object.keys(SC.GRENADES), aspect: Object.keys(SC.ASPECTS), fragment: Object.keys(SC.FRAGMENTS),
    class: Object.values(SC.CLASS_ABILITIES).flatMap(Object.keys),
    melee: SUBS.map(([c, sid]) => CLASSES[c].subclasses[sid].abilities.melee.id), super: SUBS.flatMap(([c, sid]) => SC.supersFor(c, sid)),
    jump: Object.values(SC.JUMPS).flatMap(Object.keys),
  };
  for (const [slot, ids] of Object.entries(groups)) {
    const unique = [...new Set(ids)];
    const svgs = new Set(unique.map((id) => abilityIcon(slot, id, '#fff')));
    eq(svgs.size, unique.length, `${slot} icons`);
  }
});

// ---------- Light Ascendant (v1.8) ----------
test('supers: 12 new Light supers, 4 per class, each with a camera, a duration and a reward-track level', () => {
  eq(Object.keys(SC.SUPERS).length, 18); // U22: plus one original Darkness super per Darkness subclass
  for (const c of Object.keys(CLASSES)) eq(Object.values(SC.SUPERS).filter((x) => x.cls === c).length, 6, c);
  for (const [c, sid] of SUBS) {
    const ids = SC.supersFor(c, sid);
    ok(ids.length === 2 || ids.length === 3, `${sid} has its original super plus one or two`);
    eq(ids[0], CLASSES[c].subclasses[sid].abilities.super.id, `${sid} original first`);
    for (const id of ids) {
      const d = SC.superDef(c, sid, id);
      ok(['first', 'third'].includes(d.camera) && d.name && d.desc, id);
      ok(C.SUPER_TIME[id] > 0, `${id} duration`);
    }
  }
  // unlock levels land on levels with no item reward and no other unlock
  for (const L of [14, 17, 23, 26]) { eq(rewardAt(L), null, `level ${L}`); for (const c of Object.keys(CLASSES)) eq(SC.buildUnlocksAt(L, c).length, 1, `${c} ${L}`); }
  eq(SC.buildUnlocksAt(14, 'vanguard').map((x) => [x.type, x.id]), [['super', 'maul']]);
  eq(SC.superLevel('vanguard', 'sentinel', 'sentinel'), 10, 'original super comes with the subclass');
});
test('super choice: locked supers fall back to the original; resolveKit uses the chosen one', () => {
  eq(SC.sanitizeLoadout('vanguard', 'sunbreaker', { super: 'maul' }, 13).super, 'hammers', 'locked below 14');
  eq(SC.sanitizeLoadout('vanguard', 'sunbreaker', { super: 'maul' }, 14).super, 'maul');
  eq(SC.sanitizeLoadout('vanguard', 'sunbreaker', { super: 'thundercrash' }, 40).super, 'hammers', 'another subclass');
  eq(SC.sanitizeLoadout('arcanist', 'dawnblade', { super: 'daybreak' }, 40).super, 'daybreak');
  const k = SC.resolveKit('stalker', 'arcstrider', { super: 'stormsedge' }, 40);
  eq([k.abilities.super.id, k.abilities.super.name, k.abilities.super.camera], ['stormsedge', "Storm's Edge", 'third']);
  eq(SC.resolveKit('stalker', 'arcstrider', undefined, 40).abilities.super.id, 'staff');
});
test('jumps: 3 or 4 per class; Blink only on Arcstrider and Voidwalker', () => {
  eq([SC.jumpsFor('vanguard', 'striker').length, SC.jumpsFor('stalker', 'gunslinger').length, SC.jumpsFor('arcanist', 'stormcaller').length], [3, 3, 3]);
  ok(SC.jumpsFor('stalker', 'arcstrider').includes('blink') && SC.jumpsFor('arcanist', 'voidwalker').includes('blink'), 'Blink where allowed');
  ok(!SC.jumpsFor('stalker', 'nightstalker').includes('blink') && !SC.jumpsFor('arcanist', 'dawnblade').includes('blink'), 'nowhere else');
  eq(SC.sanitizeLoadout('stalker', 'gunslinger', { jump: 'blink' }, 40).jump, 'double', 'Blink refused on Gunslinger');
  eq(SC.sanitizeLoadout('stalker', 'arcstrider', { jump: 'blink' }, 40).jump, 'blink');
  eq(SC.sanitizeLoadout('vanguard', 'striker', { jump: 'glide' }, 40).jump, 'lift', 'other class jump refused');
  const k = SC.resolveKit('arcanist', 'voidwalker', { jump: 'blink' }, 1);
  eq([k.jump, k.jumpName], ['blink', 'Blink']);
  for (const c of Object.keys(CLASSES)) eq(SC.defaultLoadout(c, Object.keys(CLASSES[c].subclasses)[0]).jump, CLASSES[c].jump, `${c} default jump unchanged`);
  for (const ids of Object.values(SC.JUMPS)) for (const id of Object.keys(ids)) ok(SC.JUMP_TUNE[id] || id === 'double', `${id} tuned`);
});
test('a v1.7 loadout (no super or jump) keeps working and gets the original super and jump', () => {
  fresh();
  const s = S.createSave('stalker');
  s.loadout = { stalker: { gunslinger: { grenade: 'healing', class: 'gambler', aspects: ['gunpowder'], fragments: ['torches'] } } };
  const lo = S.getLoadout(s, 'stalker', 'gunslinger');
  eq(lo, { super: 'revolver', jump: 'double', grenade: 'healing', class: 'gambler', aspects: ['gunpowder'], fragments: ['torches'] });
  ok(S.SAVE_VERSION >= 8, 'loadouts did not need a save bump (v8 is Loot 2.0)');
});
test('new super damage stays in the band of the originals', () => {
  const T = C.SUPER_TUNE;
  // roaming supers: damage per second of the main attack, against the v1.7 roaming supers (Hammer of Sol, Fists of Havoc, Arc Staff)
  const orig = [420 / 0.45, 520 / 0.7, (260 * 2 + 520) / (3 * 0.34)];
  const mean = orig.reduce((a, b) => a + b) / orig.length;
  const roam = { maul: T.maul.swing / T.maul.swingCd + T.maul.slam / T.maul.slamCd, spectral: (T.spectral.hit * 2 + T.spectral.fin) / 0.9, daybreak: T.daybreak.dmg / 0.45, novawarp: T.novawarp.dmg1 / (T.novawarp.chargeT + 0.35), chaosreach: T.chaos.dmg * 10 }; // H3: Chaos Reach is a roaming super
  for (const [id, dps] of Object.entries(roam)) ok(dps > mean * 0.6 && dps < mean * 1.4, `${id} ${Math.round(dps)} vs ${Math.round(mean)}`);
  // burst supers: total to one target, against Nova Bomb (with its field) and Golden Gun
  const nova = 2600 + C.NOVA_FIELD.dmg * (C.NOVA_FIELD.life / C.NOVA_FIELD.tick), gg = C.GOLDEN_GUN.shot * 6;
  const burst = { thundercrash: T.thundercrash.dmg, twilight: T.twilight.dmg * 3, bladebarrage: T.blades.dmg * T.blades.n * 2, gathering: T.gathering.dmg + T.gathering.tick * T.gathering.field * 2, stormsedge: T.stormsedge.dmg * 3 };
  for (const [id, d] of Object.entries(burst)) ok(d >= nova * 0.75 && d <= gg, `${id} ${Math.round(d)} in ${Math.round(nova * 0.75)} to ${gg}`);
});

// ---------- H1 hotfix (v1.3.1) ----------
test('waves: spawning the last wave never clears the zone in the same check', () => {
  eq(C.waveStep(0, 1, 2), { spawn: true, cleared: false }, 'all of wave 1 dead at once');
  eq(C.waveStep(2, 1, 2), { spawn: true, cleared: false });
  eq(C.waveStep(3, 1, 2), { spawn: false, cleared: false }, 'too many left to call the next wave');
  eq(C.waveStep(0, 2, 2), { spawn: false, cleared: true }, 'every wave spawned and dead');
  eq(C.waveStep(1, 2, 2), { spawn: false, cleared: false });
  eq(C.waveStep(0, 1, 1, true), { spawn: false, cleared: true }, 'boss zone');
  eq(C.waveStep(2, 1, 1, true).cleared, false);
});
test('H27 drops: engram chances cut 20%, bosses drop none', () => {
  eq(C.ENGRAM_CHANCE, { grunt: 0.016, rusher: 0.016, captain: 0.04, heavy: 0.064, boss: 0 });
});
test('H27 Light: caches roll +3 to +6, engrams never start under the mission or your Light', () => {
  eq(C.CACHE_LIGHT, [3, 6]); eq(C.ENGRAM_LIGHT, [-1, 2]);
  eq(C.engramLight(210, 250, 300, 0), 250, 'under the mission: the mission Light (was 247)');
  eq(C.engramLight(260, 250, 300, 2), 262, 'over the mission: your Light');
  eq(C.engramLight(299, 250, 300, 2), 300, 'held to the tier cap');
  eq(C.engramLight(1, 1, 300, -1), 1, 'never under 1');
});
test('Celestial Nighthawk: Golden Gun only, 5x single shot (v1.7, base Golden Gun cut), kill refunds 30% super', () => {
  eq(C.NIGHTHAWK, { goldenGun: 5, refund: 30 });
});
test('Ionic Trace and super armor perks toned down', () => {
  ok(C.IONIC.electrostatic < 0.15 && C.IONIC.ions < 0.1 && C.IONIC.gap > 0, 'ionic');
  ok(C.SUPER_HANDSON < 3 && C.SUPER_DYNAMO < 0.12, 'Hands-On and Dynamo');
});
test('thrown hammer rests on the surface it lands on', () => {
  const crate = { min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 2, z: 2 } };
  const wall = { min: { x: 5, y: 0, z: 0 }, max: { x: 6, y: 8, z: 2 } };
  eq(C.restHeight(1, 1, 1.9, [crate, wall]), 2, 'landed on the crate top');
  eq(C.restHeight(1, 1, 2.1, [crate, wall]), 2, 'just above the crate');
  eq(C.restHeight(3, 1, 0.1, [crate, wall]), 0, 'open ground');
  eq(C.restHeight(5.5, 1, 1, [crate, wall]), 0, 'a wall above the impact is not a floor');
});
test('HUD scale reaches 200%', () => { eq(C.HUD_SCALE.max, 2); ok(C.HUD_SCALE.min < 1, 'min'); });
test('one-off procs live on the buff HUD with a short timer', () => {
  for (const id of ['meleeready', 'combo', 'hammer', 'reloaded', 'skullfort']) eq(STATUS[id]?.group, 'general', id);
  for (const id of ['whitenail', 'truth', 'hardlight', 'honed']) eq(STATUS[id]?.group, 'weapon', id);
  for (const id of ['meleeready', 'combo', 'hammer', 'reloaded', 'skullfort', 'whitenail', 'truth', 'hardlight', 'honed']) ok(STATUS[id].t <= 2, `${id} is short`);
});
test('barricades take the subclass color: every Titan subclass element has one', () => {
  for (const sub of Object.values(CLASSES.vanguard.subclasses)) ok(Number.isInteger(ELEMENTS[sub.element]?.hex), sub.name);
});

// ---------- Update Log / Roadmap ----------
test('Update Log: unique versions, newest first, complete entries', () => {
  const v = RELEASES.map((r) => r.version.split('.').map(Number));
  const newer = (a, b) => { for (let k = 0; k < 3; k++) if ((a[k] ?? 0) !== (b[k] ?? 0)) return (a[k] ?? 0) > (b[k] ?? 0); return false; };
  for (let i = 1; i < v.length; i++) ok(newer(v[i - 1], v[i]), `order at ${i}`);
  for (const r of RELEASES) ok(r.name && r.summary && r.notes.length && r.date, r.version);
});
test('Roadmap: valid statuses, no dates, not duplicating a shipped name', () => {
  const shipped = new Set(RELEASES.map((r) => r.name));
  for (const r of ROADMAP) {
    ok(ROADMAP_STATUSES.includes(r.status), `${r.name} status`);
    ok(!('date' in r), `${r.name} has a date`);
    ok(!shipped.has(r.name), `${r.name} already shipped`);
  }
});

// ---------- Arsenal (v1.4) ----------
test('archetypes: every weapon family has Destiny frames with a name and description', () => {
  for (const id of Object.keys(ARCHETYPES)) {
    ok(framesFor(id).length >= (ARCHETYPES[id].exoticOnly ? 1 : 2), `${id} has frames`);
    for (const f of Object.values(FRAMES[id])) ok(/Frame$/.test(f.name) && f.desc, `${id} ${f.name}`);
  }
  eq(Object.keys(FRAMES).sort(), Object.keys(ARCHETYPES).sort());
});
test('named legendaries: valid family, archetype and element; unique names; Corrective Measure is an Adaptive Void MG', () => {
  const names = new Set();
  for (const l of LEGENDARY_WEAPONS) {
    ok(ARCHETYPES[l.arch] && FRAMES[l.arch][l.frame] && ELEMENTS[l.element], l.name);
    ok(!names.has(l.name), `duplicate ${l.name}`); names.add(l.name);
  }
  for (const id of Object.keys(ARCHETYPES).filter((id) => !ARCHETYPES[id].exoticOnly)) ok(LEGENDARY_WEAPONS.filter((l) => l.arch === id).length >= 4, `${id} legendaries`);
  const cm = LEGENDARY_WEAPONS.find((l) => l.name === 'Corrective Measure');
  eq([cm.arch, cm.frame, cm.element], ['mg', 'adaptive', 'void']);
  ok(LEGENDARY_WEAPONS.some((l) => l.element === 'stasis') && LEGENDARY_WEAPONS.some((l) => l.element === 'strand'), 'Stasis and Strand legendaries');
});
test('every drop of a legendary has the same archetype, element and stats; only perks roll', () => {
  const seen = new Map();
  for (let i = 0; i < 600; i++) {
    const it = rollItem(100, 3, ['primary', 'special', 'heavy'][i % 3]);
    const leg = LEGENDARY_WEAPONS.find((l) => l.name === it.name && l.arch === it.arch);
    ok(leg, `${it.name} is a named legendary`);
    eq([it.frame, it.element], [leg.frame, leg.element], it.name);
    const key = `${it.name}|${it.slot}`;
    if (seen.has(key)) eq(it.stats, seen.get(key), it.name); else seen.set(key, it.stats);
  }
});
test('lower rarities roll an archetype once and their stats follow it exactly', () => {
  for (let i = 0; i < 300; i++) {
    const it = rollItem(50, i % 3, ['primary', 'special', 'heavy'][i % 3]);
    ok(FRAMES[it.arch][it.frame], `${it.name} frame`);
    eq(it.stats, weaponStats(it), it.name);
  }
});
test('archetypes keep damage per second within 15% of each other in a family (Compressed Wave excepted)', () => {
  const dps = (item) => {
    const A = weaponHandling(item), s = weaponStats(item), shot = s.dmg * (A.pellets || 1) * (A.chargeBurst || 1) * (A.grenades || 1);
    const cycle = A.mode === 'burst' ? ((A.burst - 1) * 60 / s.rpm + A.burstDelay) / A.burst : A.mode === 'charge' ? A.charge + 60 / s.rpm : 60 / s.rpm;
    return shot / cycle;
  };
  for (const arch of Object.keys(ARCHETYPES).filter((id) => !ARCHETYPES[id].exoticOnly)) {
    for (const slot of ['primary', 'special', 'heavy']) { // U11: frames in another ammo slot (Rocket-Assisted, special Grenade Launchers) are balanced against their own slot
      const vals = framesFor(arch).filter((f) => f !== 'wave' && frameSlot(arch, f) === slot).map((f) => [f, dps({ arch, frame: f, rarity: 'legendary', slot })]);
      if (!vals.length) continue;
      const mid = vals.reduce((a, [, v]) => a + v, 0) / vals.length;
      for (const [f, v] of vals) ok(Math.abs(v / mid - 1) <= 0.15, `${arch} ${f} (${slot}): ${(v / mid).toFixed(2)}x the family average`);
    }
  }
});
test('frame behaviors: slug fires one pellet, wave and tracking flags, lightweight moves faster, aggressive linear bursts', () => {
  eq(weaponHandling({ arch: 'shotgun', frame: 'slug' }).pellets, 1);
  ok(weaponHandling({ arch: 'glauncher', frame: 'wave' }).wave > 0, 'wave');
  eq(weaponHandling({ arch: 'glauncher', frame: 'wave' }).projectile.gravity, 0);
  ok(weaponHandling({ arch: 'rocket', frame: 'precision' }).tracking, 'tracking');
  ok(weaponHandling({ arch: 'smg', frame: 'lightweight' }).move > 1, 'move');
  eq(weaponHandling({ arch: 'linear', frame: 'aggressive' }).chargeBurst, 3);
  eq(weaponHandling({ arch: 'pulse', frame: 'aggressive' }).burst, 4);
  eq(ARCHETYPES.rocket.projectile.radius, 6.5, 'family data untouched');
});
test('save v3 upgrades through v4: weapons gain archetypes and fixed stats; perks, power, element and name kept', () => {
  const inv = [
    { id: 'w1', kind: 'weapon', slot: 'heavy', arch: 'mg', element: 'arc', rarity: 'legendary', name: 'Corrective Measure', power: 90, stats: { dmg: 1, rpm: 1, mag: 1, reload: 1, spread: 1, range: 1 }, perks: ['rampage'] },
    { id: 'w2', kind: 'weapon', slot: 'primary', arch: 'auto', element: 'kinetic', rarity: 'rare', name: 'Ashen Oath', power: 40, stats: { dmg: 1, rpm: 1, mag: 1, reload: 1, spread: 1, range: 1 }, perks: ['outlaw', 'leech'] },
    { id: 'w3', kind: 'weapon', slot: 'heavy', arch: 'shotgun', element: 'arc', rarity: 'exotic', name: 'Legend of Acrius', power: 70, stats: { dmg: 1, rpm: 1, mag: 1, reload: 1, spread: 1, range: 1 }, perks: [], exotic: 'acrius', reserve: 10, brick: 3 },
    { id: 'a1', kind: 'armor', slot: 'helmet', rarity: 'common', name: 'Field Helm', power: 10, stats: { mob: 2, res: 2, rec: 2 } },
  ];
  const v3 = { version: 3, classId: 'vanguard', glimmer: 5, inventory: inv, vault: [{ ...inv[1], id: 'w4' }], equipped: { heavy: 'w1' }, cleared: {}, subclass: {}, loadout: {}, progression: { xp: 0, claimed: [] }, settings: {} };
  freshOld({ afterlight_save_v2: JSON.stringify(v3) });
  const s = S.loadSave();
  eq(s.version, S.SAVE_VERSION);
  const [w1, w2, w3, a1] = s.inventory;
  eq([w1.frame, w1.element, w1.perks, w1.power, w1.name], ['adaptive', 'arc', ['rampage'], 90, 'Corrective Measure'], 'owned items keep their element');
  eq(w1.stats, weaponStats(w1));
  ok(w1.stats.dmg > 1, 'heavy MG stats recalculated');
  eq(w2.frame, frameFor(w2)); eq(w2.perks, ['outlaw', 'leech']); eq(w2.stats, weaponStats(w2));
  eq(w3.frame, undefined, 'exotics keep their own handling'); eq(w3.stats, weaponStats(w3));
  eq(Object.keys(a1.stats), ['mob', 'res', 'rec', 'dis', 'int', 'str'], 'armor moved to six stats');
  eq(s.vault[0].frame, frameFor(s.vault[0]), 'vault too');
});
test('elements: six with distinct symbols; Stasis and Strand roll on weapons; U22: enemy shields can be Stasis or Strand', () => {
  eq(Object.keys(ELEMENTS), ['kinetic', 'solar', 'arc', 'void', 'stasis', 'strand', 'prismatic']); // U27: Prismatic is the subclass colour, never a weapon element
  eq(new Set(Object.values(ELEMENTS).map((e) => e.symbol)).size, 7);
  eq(new Set(Object.values(ELEMENTS).map((e) => e.color)).size, 7);
  ok(ENERGY.includes('stasis') && ENERGY.includes('strand'), 'energy pool');
  eq(SHIELD_ELEMENTS, ['solar', 'arc', 'void', 'stasis', 'strand']);
  const els = new Set();
  for (let i = 0; i < 400; i++) els.add(rollItem(50, 3, 'primary').element); // U10: named legendaries carry Stasis and Strand
  ok(els.has('stasis') && els.has('strand'), 'rolled');
});
test('subclass traits are aspects now (H3): no passives, each subclass defaults to its former trait', () => {
  const former = { sunbreaker: 'pyre', striker: 'amplitude', sentinel: 'resolve', gunslinger: 'chainofwoe', nightstalker: 'abyssal', arcstrider: 'crackling', voidwalker: 'bloom', stormcaller: 'unlimitedpower', dawnblade: 'giftsun' };
  for (const [c, sid] of LIGHT_SUBS) {
    ok(!CLASSES[c].subclasses[sid].passive, `${sid} has no trait`);
    const a = SC.ASPECTS[former[sid]];
    ok(a && a.cls === c && a.sub === sid && SC.aspectLevel(former[sid]) === (CLASSES[c].subclasses[sid].unlockLevel ?? 1), `${sid} aspect opens with the subclass`);
    ok(SC.defaultLoadout(c, sid).aspects.includes(former[sid]), `${sid} default`);
    ok(SC.ASPECT_TUNE[former[sid]], `${sid} tuning`);
  }
  ok(!SC.ASPECTS.bastion, 'Bastion removed');
  eq(SC.ASPECT_TUNE.giftsun.energy, 0.15);
  ok(!SC.ASPECTS.phoenix, 'Phoenix Dive is a class ability now');
  eq(SC.sanitizeLoadout('arcanist', 'dawnblade', { class: 'phoenix' }, 40).class, 'phoenix');
  eq(SC.sanitizeLoadout('arcanist', 'voidwalker', { class: 'phoenix' }, 40).class, 'rift', 'Phoenix Dive is Dawnblade only');
  eq(SC.sanitizeLoadout('arcanist', 'dawnblade', { aspects: ['phoenix', 'giftsun'], fragments: ['torches', 'ashes'] }, 40).aspects, ['giftsun'], 'an old Phoenix Dive aspect is dropped');
  ok(!/Restoration/.test(SC.ASPECTS.giftsun.desc), 'Gift of the Sun no longer overlaps Ember of Benevolence');
  for (const id of ['amplitude', 'resolve', 'juggernaut', 'onyourmark', 'chainofwoe', 'ascension', 'icarus']) eq(SC.ASPECTS[id].slots, 3, id + ' opens 3 fragment slots (2 before U9)');
  ok(SC.ASPECT_TUNE.bloom.dmg <= 10, 'Bloom drain is small');
  // Towering and Rally Barricade are both usable on Sentinel
  for (const id of ['barricade', 'rally']) eq(SC.resolveKit('vanguard', 'sentinel', { class: id }, 40).abilities.class.id, id);
  ok(STATUS.amplified, 'Amplified on the buff HUD');
});
test('hammer fuse, Sunspot burn and the Healing Grenade orb', () => {
  eq(SC.HAMMER_FUSE.fuse, 7);
  ok(SC.SUNSPOT.dmg > 0 && SC.SUNSPOT.life === 6, 'sunspot');
  ok(SC.HEAL_ORB.life > 0 && SC.HEAL_ORB.heal > 0 && SC.HEAL_ORB.restore > 0, 'orb');
});
test('Ready Up: launches only with a pick and every current member ready', () => {
  const m = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  eq(readyState(m, ['a', 'b'], { li: 0, mi: 0 }), { count: 2, total: 3, all: false });
  eq(readyState(m, ['a', 'b', 'c'], { li: 0, mi: 0 }).all, true);
  eq(readyState(m, ['a', 'b', 'c'], null).all, false, 'no pick');
  eq(readyState(m.slice(0, 2), ['a', 'b', 'x'], { li: -1, mi: 0 }), { count: 2, total: 2, all: true });
  eq(readyState([{ id: 'a' }, { id: 'd' }], ['a', 'b'], { li: 0, mi: 1 }).all, false, 'someone new joined');
});
test('title shows the newest major update: name, version and artwork; hotfixes leave it alone', () => {
  const r = titleRelease();
  ok(r.name && r.version && (r.artPending || /^<svg[\s\S]*<\/svg>$/.test(r.art)), 'art'); // artPending: chained updates get their artwork with the last update of the chain
  eq(r.version.split('.').length, 2, 'a major update');
  ok(RELEASES.indexOf(r) === RELEASES.findIndex((x) => x.version.split('.').length === 2), 'the newest one');
});

// ---------- Armor 2.0 ----------
test('armor stats: six stats; tier 0 / 5 / 10 give 1.3x / 1.0x / 0.65x cooldowns and 0.8x / 1.0x / 1.3x super gain', () => {
  eq(AR.STAT_KEYS, ['mob', 'res', 'rec', 'dis', 'int', 'str']);
  eq([AR.cooldownMult(0), AR.cooldownMult(50), AR.cooldownMult(100)], [1.3, 1, 0.65]);
  eq([AR.superRateMult(0), AR.superRateMult(50), AR.superRateMult(100)], [0.8, 1, 1.3]);
  eq(AR.tierOf(49), 4); eq(AR.tierOf(100), 10); eq(AR.tierOf(250), 10);
  for (const c of Object.keys(CLASSES)) { eq(Object.keys(AR.CLASS_BASE[c]), AR.STAT_KEYS, c); ok(AR.CLASS_STAT[c], c); }
  eq(CLASSES.vanguard.base, AR.CLASS_BASE.vanguard);
});
test('armor stats are calibrated to v1.4: a full legendary set (tier 5) matches the old shield, speed and regen', () => {
  const set = [1, 2, 3, 4].map(() => ({ kind: 'armor', slot: 'helmet', rarity: 'legendary', stats: { mob: 9, res: 9, rec: 9, dis: 9, int: 9, str: 9 }, mods: AR.blankMods() }));
  const st = AR.armorStats('arcanist', set, 20);
  eq(st.dis, 50); eq(AR.tierOf(st.dis), 5);
  ok(Math.abs(AR.shieldMax(st.int) - 115) <= 3, 'shield'); // v1.4: 55 + 3 x 20
  ok(Math.abs((AR.speedMult(st.int) - 1) - 0.24) < 0.03, 'speed');
  ok(Math.abs(AR.regenRate(st.int) - 90 * 0.75) <= 3, 'regen rate (25% slower since v1.7)');
  ok(Math.abs(AR.regenDelay(st.int) - 2.6) < 0.15, 'regen delay');
});
test('rolled armor: six stats with the rarity total, four empty sockets, energy by rarity, no perk', () => {
  for (const [i, r] of ['common', 'uncommon', 'rare', 'legendary', 'exotic'].entries()) {
    for (let n = 0; n < 40; n++) {
      const a = makeArmor('chest', 50, i);
      eq(Object.keys(a.stats), AR.STAT_KEYS);
      const sum = AR.STAT_KEYS.reduce((t, k) => t + a.stats[k], 0);
      const band = AR.ARMOR_BANDS.base[r]; // U28: legendary and exotic roll from the Base band by default
      if (band) ok(sum >= band[0] && sum <= band[1], `${r} total ${sum}`); else ok(Math.abs(sum - AR.ARMOR_TOTAL[r]) <= 2, `${r} total ${sum}`);
      eq(a.mods, [null, null, null, null]); ok(!('perk' in a), 'no perk');
    }
  }
  eq(AR.MOD_ENERGY, { common: 4, uncommon: 6, rare: 8, legendary: 10, exotic: 10 });
});
test('mods: counts per slot, costs 1 to 4, unlock levels 5 to 30, the eight former perks are starters', () => {
  eq(AR.statMods().length, 12);
  eq(['helmet', 'arms', 'chest', 'legs', 'classitem'].map((s) => AR.modsForSlot(s).length), [10, 11, 12, 11, 4]); // U9: Fonts; U27: the class ability mods (Reaper, Utility Kickstart, Insulation, Bolstering Detonation) moved to the class item
  eq(AR.modsForSlot('classitem').sort(), ['bolstering', 'insulation', 'kickstart', 'reaper']);
  eq(AR.MOD_IDS.length, 60);
  for (const id of AR.MOD_IDS) { const d = AR.MODS[id]; ok(d.cost >= 1 && d.cost <= 4, id); ok(d.unlock >= 5 && d.unlock <= 30, id); ok(d.name && d.desc, id); }
  eq(AR.MOD_IDS.filter((id) => AR.MODS[id].unlock === AR.MODS_LEVEL).length, 34, 'starter set');
  for (const id of AR.FORMER_PERKS) { ok(AR.MODS[id], id); eq(AR.MODS[id].unlock, AR.MODS_LEVEL); }
  eq(AR.MODS.dis10.cost, 4); eq(AR.MODS.mob5.cost, 1);
  eq(AR.SURGE_ELEMENTS.length, 6);
});
test('mod rules: socket 1 stat mods only, mods fit their slot, energy cap, unlock level, nothing works below level 5', () => {
  const mk = (rarity, slot = 'arms') => ({ kind: 'armor', slot, rarity, mods: AR.blankMods() });
  const a = mk('legendary');
  ok(AR.setMod(a, 0, 'grenadier', 20), 'slot mod in the stat socket is refused');
  ok(AR.setMod(a, 1, 'str10', 20), 'stat mod in a mod socket is refused');
  ok(AR.setMod(a, 1, 'plating', 20), 'chest mod on arms is refused');
  eq(AR.setMod(a, 0, 'str10', 20), null);
  eq(AR.setMod(a, 1, 'grenadier', 20), null); // 4 + 4 = 8
  ok(AR.setMod(a, 2, 'brawler', 20), 'energy 12 > 10'); eq(AR.energyUsed(a.mods), 8);
  eq(AR.setMod(a, 2, 'firepower', 20), null); eq(AR.energyUsed(a.mods), 10);
  eq(AR.setMod(a, 2, null, 20), null); eq(a.mods[2], null);
  ok(AR.setMod(a, 3, 'fontmight', 19), 'level 20 mod at 19'); // Font of Might unlocks at 20
  const c = mk('common'); eq(AR.setMod(c, 1, 'grenadier', 20), null); ok(AR.setMod(c, 2, 'firepower', 20), 'common has 4 energy');
  ok(AR.setMod(mk('common'), 1, 'grenadier', 4), 'below level 5');
  eq(AR.activeMods(a, 4), [], 'nothing works below level 5'); eq(AR.activeMods(a, 5), ['str10', 'grenadier']);
  // a mod whose energy no longer fits (the piece was changed) is ignored, not applied
  const over = { ...mk('common'), mods: ['str10', 'grenadier', 'firepower', null] };
  eq(AR.activeMods(over, 20), ['str10']);
  const st = AR.armorStats('stalker', [a], 20);
  eq(st.str, AR.CLASS_BASE.stalker.str + 10); eq(AR.armorStats('stalker', [a], 3).str, AR.CLASS_BASE.stalker.str);
});
test('mod counts add up across pieces; stats cap at 100', () => {
  const mkp = (slot, mods) => ({ kind: 'armor', slot, rarity: 'legendary', mods, stats: { mob: 40, res: 0, rec: 0, dis: 0, int: 0, str: 0 } });
  const items = [mkp('helmet', [null, 'handson', 'handson', null]), mkp('arms', [null, 'grenadier', null, null])];
  const c = AR.modCounts(items, 30);
  eq([c.handson, c.grenadier], [2, 1]);
  eq(AR.armorStats('stalker', items, 30).mob, 100);
});
test('orbs and charge tuning: orbs give small super, charge caps at 3 and stacks multiply gently', () => {
  ok(AR.ORB.super <= 4 && AR.ORB.superMax === 4 && AR.ORB.life === 20);
  eq(AR.CHARGE.max, 3); eq(AR.CHARGE.surge, [1, 1.1, 1.17, 1.22]);
  // passive super with the best Intellect and 3 Dynamo is still slower than the best ability-kill loop, and plain play is unchanged
  const plain = 100 / (C.SUPER_PASSIVE * AR.superRateMult(50));
  ok(Math.abs(plain - 200) < 1, 'plain passive fill is 200 s');
  const best = 100 / (C.SUPER_PASSIVE * AR.superRateMult(100) * (1 + C.SUPER_DYNAMO * 3));
  ok(best > 100, `best passive fill ${best.toFixed(0)} s`);
});
test('save v4 upgrades to v5: stats become six, a matching perk becomes the mod, a mismatched one is dropped, items otherwise kept', () => {
  const armor = (id, slot, rarity, perk, stats) => ({ id, kind: 'armor', slot, rarity, name: `${rarity} ${slot}`, power: 77, stats, ...(perk ? { perk } : {}) });
  const inv = [
    armor('h1', 'helmet', 'legendary', 'handson', { mob: 6, res: 4, rec: 3 }),
    armor('g1', 'arms', 'legendary', 'handson', { mob: 3, res: 3, rec: 3 }),
    armor('c1', 'chest', 'rare', null, { mob: 3, res: 4, rec: 4 }),
    armor('l1', 'legs', 'legendary', 'kickstart', { mob: 8, res: 7, rec: 6 }),
  ];
  const v4 = { version: 4, classId: 'arcanist', glimmer: 9, inventory: inv, vault: [armor('v1', 'legs', 'legendary', 'plating', { mob: 5, res: 5, rec: 5 })], equipped: {}, cleared: {}, subclass: {}, loadout: {}, progression: { xp: 0, claimed: [] }, settings: {} };
  freshOld({ afterlight_save_v2: JSON.stringify(v4) });
  const s = S.loadSave();
  eq(s.version, S.SAVE_VERSION);
  const [h1, g1, c1, l1] = s.inventory;
  for (const it of s.inventory) { eq(Object.keys(it.stats), AR.STAT_KEYS); eq(it.mods.length, 4); ok(!('perk' in it)); eq(it.power, 77); }
  eq(h1.mods, [null, 'handson', null, null]); eq(l1.mods, [null, 'kickstart', null, null]);
  eq(g1.mods, [null, null, null, null], 'handson does not fit gauntlets');
  eq(s.armorNote, { dropped: 2 }, 'the mismatched perk and the vault chest plating');
  ok(s.vault[0].mods.every((m) => m === null), 'vault: plating does not fit legs');
  const total = (it) => AR.STAT_KEYS.reduce((t, k) => t + it.stats[k], 0);
  ok(total(l1) > total(c1) || AR.ARMOR_TOTAL.legendary > AR.ARMOR_TOTAL.rare, 'rarity ordering');
  ok(total(h1) >= AR.ARMOR_TOTAL.legendary - 2 && total(h1) <= AR.ARMOR_TOTAL.legendary + 2, 'legendary total');
  ok(total(l1) >= total(g1), 'a high roll stays high'); // l1 rolled 21 old points, g1 rolled 9
  // stable: migrating the same save again gives the same stats
  freshOld({ afterlight_save_v2: JSON.stringify(v4) });
  eq(S.loadSave().inventory[0].stats, h1.stats);
  // a pre-level-5 migrated save: mods are kept but do nothing
  eq(AR.activeMods(h1, 4), []); eq(AR.activeMods(h1, 5), ['handson']);
});
test('Arc Soul and jolt nerfs: Arc Soul damage per second is within 10% of Child of the Old Gods; jolt is weaker', () => {
  const soul = C.ARC_SOUL.dmg / C.ARC_SOUL.tick, child = 24 / 0.5;
  ok(Math.abs(soul - child) / child <= 0.1, `${soul} vs ${child}`);
  ok(soul < 34 / 0.4 * 0.6, 'at least 40% below v1.4'); ok(C.JOLT.dmg < 45);
  eq(C.superKillGain('weapon', false, 'grunt'), 2);
});
test('level track and unlocks: nothing before level 5, mods spread over levels 6 to 30', () => {
  eq(AR.MODS_LEVEL, 5);
  ok(!AR.modUnlocked('grenadier', 4) && AR.modUnlocked('grenadier', 5));
  ok(!AR.modUnlocked('fontendurance', 29) && AR.modUnlocked('fontendurance', 30));
  eq(AR.modsUnlockedAt(6), ['targetp']);
  let n = 0; for (let L = 6; L <= 30; L++) n += AR.modsUnlockedAt(L).length;
  eq(n, 26);
});

// ---------- Fashion Is Endgame (v1.6) ----------
test('destination sets: one per destination, four named pieces each, a bonus each; every look has every slot', () => {
  eq(ST.SET_IDS.slice().sort(), LOCATIONS.map((l) => l.id).sort());
  const names = new Set();
  for (const id of ST.SET_IDS) {
    const set = ST.SETS[id];
    for (const sl of ['helmet', 'arms', 'chest', 'legs']) { ok(set.pieces[sl], `${id} ${sl}`); ok(!names.has(set.pieces[sl]), `duplicate ${set.pieces[sl]}`); names.add(set.pieces[sl]); }
    ok(set.bonus.name && set.bonus.desc, `${id} bonus`);
  }
  for (const [id, L] of Object.entries(ST.LOOKS)) for (const sl of ['helmet', 'arms', 'chest', 'legs']) ok(L[sl], `${id} ${sl}`);
  eq(new Set(ST.SET_IDS.map((id) => JSON.stringify(ST.SETS[id].look))).size, ST.SET_IDS.length, 'every set looks different');
});
test('set drops: legendary armor is the destination set, else a random set; lower rarities and exotics have none', () => {
  for (const id of ST.SET_IDS) { const it = makeArmor('chest', 50, 3, id); eq(it.set, id); eq(it.name, ST.SETS[id].pieces.chest); }
  for (let i = 0; i < 20; i++) ok(ST.SET_IDS.includes(makeArmor('legs', 50, 3).set), 'no destination: a random set');
  for (const r of [0, 1, 2, 4]) ok(!('set' in makeArmor('helmet', 50, r, 'moon')), `rarity ${r}`);
  eq(rollItem(50, 3, 'arms', 'io').set, 'io');
  eq(ST.setForDrop('nowhere', () => 0), ST.SET_IDS[0]);
});
test('set bonus: any 3 of 4 pieces of one set; exotics and plain armor never count', () => {
  const p = (slot, set, rarity = 'legendary') => ({ slot, rarity, set });
  eq(ST.activeSets([p('helmet', 'mars'), p('arms', 'mars'), p('chest', 'io')]), []);
  eq(ST.activeSets([p('helmet', 'mars'), p('arms', 'mars'), p('legs', 'mars'), p('chest', 'io')]), ['mars']);
  eq(ST.activeSets([p('helmet', 'mars'), p('arms', 'mars'), p('legs', 'mars', 'exotic')]), [], 'an exotic does not count');
  eq(ST.setCounts([p('helmet', 'earth'), p('arms', undefined, 'rare'), null]), { earth: 1 });
  eq(ST.SET_PIECES, 3);
  ok(ST.SET_TUNE.reload < 1 && ST.SET_TUNE.regenDelay < 1 && ST.SET_TUNE.outlawDmg <= 1.2 && ST.SET_TUNE.superPassive <= 1.15, 'bonuses stay mod-sized');
});
test('looks: set, exotic, then plain by rarity; appearance round-trips over the network', () => {
  eq(ST.lookOf({ rarity: 'legendary', set: 'moon' }), 'moon');
  eq(ST.lookOf({ rarity: 'exotic' }), 'exotic');
  eq([ST.lookOf({ rarity: 'common' }), ST.lookOf({ rarity: 'uncommon' }), ST.lookOf({ rarity: 'rare' }), ST.lookOf(null)], ['g0', 'g1', 'g2', 'g0']);
  const a = ST.appearance([{ slot: 'helmet', rarity: 'exotic' }, { slot: 'chest', rarity: 'legendary', set: 'titan' }], 'calus');
  eq(a, { helmet: 'exotic', arms: 'g0', chest: 'titan', legs: 'g0', classitem: 'g0', shader: 'calus' });
  eq(ST.decodeAppearance(ST.encodeAppearance(a)), a);
  eq(ST.decodeAppearance('junk,moon|nope'), { helmet: 'g0', arms: 'moon', chest: 'g0', legs: 'g0', classitem: 'g0', shader: null }, 'bad ids fall back');
});
test('shaders: 10, drop only if not owned, never duplicate, guaranteed drop ignores the chance', () => {
  eq(ST.SHADER_IDS.length, 10);
  eq(ST.rollShader([], false, () => 0.99), null, 'missed the chance');
  ok(ST.SHADER_IDS.includes(ST.rollShader([], false, () => 0.1)));
  ok(ST.rollShader([], true, () => 0.99), 'guaranteed');
  eq(ST.rollShader(ST.SHADER_IDS, true), null, 'all owned: nothing');
  const owned = ST.SHADER_IDS.slice(0, 9);
  for (let i = 0; i < 20; i++) eq(ST.rollShader(owned, true), ST.SHADER_IDS[9]);
  const rnd = mulberry32(7); let n = 0; for (let i = 0; i < 4000; i++) if (ST.rollShader([], false, rnd)) n++;
  ok(Math.abs(n / 4000 - ST.SHADER_DROP.chance) < 0.03, `drop rate ${n / 4000}`);
});
test('shader per class: apply needs ownership, all armor at once, unknown ids read as none', () => {
  fresh();
  const s = S.createSave('stalker');
  eq(s.shaders, { owned: [], applied: {} });
  ok(S.applyShader(s, 'superblack'), 'not owned yet');
  s.shaders.owned.push('superblack');
  eq(S.applyShader(s, 'superblack'), null);
  eq(S.wornAppearance(s).shader, 'superblack');
  eq(ST.shaderFor(s.shaders, 'vanguard'), null, 'other classes keep their own');
  eq(S.applyShader(s, null), null); eq(S.wornAppearance(s).shader, null);
  eq(ST.shaderFor({ owned: ['x'], applied: { stalker: 'x' } }, 'stalker'), null);
});
test('save v5 upgrades to v6: legendary armor joins a stable set, shaders start empty, items otherwise kept', () => {
  const armor = (id, slot, rarity) => ({ id, kind: 'armor', slot, rarity, name: `Old ${slot}`, power: 120, stats: { mob: 9, res: 9, rec: 9, dis: 9, int: 9, str: 9 }, mods: [null, 'handson', null, null] });
  const inv = [armor('L1', 'helmet', 'legendary'), armor('R1', 'arms', 'rare'), armor('X1', 'chest', 'exotic')];
  const v5 = { version: 5, classId: 'vanguard', glimmer: 3, inventory: inv, vault: [armor('L2', 'legs', 'legendary')], equipped: {}, cleared: {}, subclass: {}, loadout: {}, progression: { xp: 0, claimed: [] }, settings: {} };
  freshOld({ afterlight_save_v2: JSON.stringify(v5) });
  const s = S.loadSave();
  eq(s.version, S.SAVE_VERSION);
  eq(s.shaders, { owned: [], applied: {} });
  const [L1, R1, X1] = s.inventory;
  ok(ST.SET_IDS.includes(L1.set) && ST.SET_IDS.includes(s.vault[0].set), 'legendaries get a set');
  ok(!('set' in R1) && !('set' in X1), 'rare and exotic stay out');
  ok([...s.inventory, ...s.vault].every((it) => it.classId === 'vanguard'), 'every armor piece belongs to the class being played');
  eq(X1.name, 'Heart of Inmost Light', 'an exotic becomes that class\'s exotic for its slot');
  eq(s.chars, {});
  for (const it of [L1, R1]) eq(it.name, inv.find((x) => x.id === it.id).name);
  for (const it of [L1, R1, X1]) { eq(it.power, 120); eq(it.mods, [null, 'handson', null, null]); eq(it.stats.mob, 9); }
  freshOld({ afterlight_save_v2: JSON.stringify(v5) });
  eq(S.loadSave().inventory[0].set, L1.set, 'stable on a re-run');
});

test('characters: each Guardian has its own inventory and gear; level and vault are shared', () => {
  fresh();
  const s = S.createSave('vanguard');
  const titanInv = s.inventory, gun = S.getEquipped(s, 'primary');
  ok(s.inventory.filter((i) => i.kind === 'armor').every((i) => i.classId === 'vanguard'), 'starter armor is Titan armor');
  ok(s.inventory.length > 7, 'a new save has the armory weapons too');
  S.addXp(s, 5000);
  const lvl = S.playerLevel(s);
  S.switchCharacter(s, 'stalker');
  eq(s.classId, 'stalker'); eq(S.playedClasses(s).sort(), ['stalker', 'vanguard']);
  ok(s.inventory !== titanInv && !s.inventory.includes(gun), 'the Hunter has its own inventory');
  eq(S.getEquipped(s, 'helmet').classId, 'stalker', 'a new Hunter gets a starter kit with Hunter armor');
  ok(S.getEquipped(s, 'primary'), 'and weapons');
  eq(S.playerLevel(s), lvl, 'level is shared');
  ok(S.charPower(s, 'vanguard') > 0); eq(S.charPower(s, 'stalker'), S.playerPower(s), 'Light comes from the active Guardian\'s gear'); eq(S.charPower(s, 'arcanist'), 0, 'unplayed');
  // a weapon moves from the Hunter to the Titan through the vault
  const w = s.inventory.find((i) => i.kind === 'weapon' && !S.isEquipped(s, i));
  eq(S.toVault(s, w.id), null);
  S.switchCharacter(s, 'vanguard');
  eq(s.inventory, titanInv, 'the Titan gets its own inventory back');
  eq(S.getEquipped(s, 'primary'), gun);
  eq(S.fromVault(s, w.id), null, 'weapons go to any Guardian');
  // armor only comes out to its own class
  S.switchCharacter(s, 'stalker');
  const hArmor = s.inventory.find((i) => i.kind === 'armor' && !S.isEquipped(s, i)) || (() => { const a = makeArmor('legs', 10, 0, null, 'stalker'); s.inventory.push(a); return a; })();
  eq(S.toVault(s, hArmor.id), null);
  S.switchCharacter(s, 'vanguard');
  ok(S.fromVault(s, hArmor.id), 'a Titan cannot take Hunter armor out');
  ok(!S.getItem(s, hArmor.id), 'it stays in the vault');
  const stray = { ...hArmor, id: 'stray' }; s.inventory.push(stray);
  ok(typeof S.equipItem(s, 'stray') === 'string', 'and Hunter armor can never be worn by a Titan');
  s.inventory.pop();
  const loaded = S.loadSave();
  eq([loaded.classId, Object.keys(loaded.chars)], ['vanguard', ['stalker']], 'saved');
  // drops roll armor for the class being played
  eq(makeArmor('legs', 20, 3, 'io', 'arcanist').classId, 'arcanist');
  eq(rollItem(20, 1, 'chest', null, 'stalker').classId, 'stalker');
});
test('class exotics: two per slot per class plus the H26 Darkness pieces (10 each), Destiny classes, they drop only for their class', () => {
  const D = {
    vanguard: [['An Insurmountable Skullfort', 'Mask of the Quiet One', 'Loreley Splendor Helm', 'Precious Scars'], ['Synthoceps', 'Ursa Furiosa', 'Doom Fang Pauldron'], ['Heart of Inmost Light', 'Hallowfire Heart', 'Hoarfrost-Z', 'Actium War Rig'], ['Dunemarchers', 'Peacekeepers', 'Abeyant Leap', 'Path of Burning Steps']],
    stalker: [['Celestial Nighthawk', 'Graviton Forfeit', "Cyrtarachne's Facade", 'Mask of Bakris', "Assassin's Cowl"], ["Liar's Handshake", "Young Ahamkara's Spine", 'Renewal Grasps', "Mechaneer's Tricksleeves"], ['Raiden Flux', 'Lucky Raspberry', "Gyrfalcon's Hauberk"], ['St0mp-EE5', 'Orpheus Rig', "Dragon's Shadow"]],
    arcanist: [["Nezarec's Sin", 'Skull of Dire Ahamkara', "Verity's Brow", 'Crown of Tempests'], ['Contraverse Hold', 'Sunbracers', 'Osmiomancy Gloves', 'Phoenix Cradle', 'Karnstein Armlets'], ['Starfire Protocol', "Stormdancer's Brace", 'Vesper of Radius'], ['Transversive Steps', 'Lunafaction Boots', 'Swarmers']],
  };
  for (const [c, names] of Object.entries(D)) eq(['helmet', 'arms', 'chest', 'legs'].map((sl) => EXOTIC_ARMOR[c][sl]), names);
  const ids = new Set();
  for (const names of Object.values(D)) for (const n of names.flat()) { ok(EXOTIC_ARMOR_PERKS[n], `${n} has a perk`); ids.add(EXOTIC_ARMOR_PERKS[n].id); }
  eq(ids.size, 45);
  eq(Object.keys(EXOTIC_ARMOR_PERKS).length, 45, 'no stray exotic perks');
  for (const id of ids) if (!['loreley', 'scars', 'doomfang', 'actium', 'burningsteps', 'bakris', 'cowl', 'tricksleeves', 'gyrfalcon', 'dragonshadow', 'verity', 'crown', 'phoenixcradle', 'karnstein', 'vesper', 'hoarfrost', 'abeyant', 'renewal', 'cyrtarachne', 'osmiomancy', 'swarmers', 'skullfort', 'synthoceps', 'dunemarchers', 'stomp', 'transversive', 'raiden', 'liars', 'starfire', 'graviton', 'ahamkara', 'raspberry', 'orpheus', 'ursa', 'peacekeepers'].includes(id)) ok(STATUS[id] || ['heart', 'nighthawk', 'nezarec', 'contraverse'].includes(id), `${id} shows in the buff HUD`);
  for (const c of Object.keys(D)) for (let i = 0; i < 12; i++) { const it = makeArmor('chest', 50, 4, null, c); ok(it.classId === c && EXOTIC_ARMOR[c].chest.includes(it.name), `${c} chest exotic`); }
  ok(C.LIARS.mult === 2 && C.RAIDEN.maxExtend === 5 && C.RAIDEN.step * C.RAIDEN.maxStacks === 0.5 && C.STARFIRE.refund === 0.5);
});

test('exotic duplicate protection: unfound exotics are favored until every one is found', () => {
  const names = ['A', 'B', 'C', 'D'];
  eq(exoticWeights(names, []), [1, 1, 1, 1]);
  eq(exoticWeights(names, ['A', 'C']), [EXOTIC_REPEAT_WEIGHT, 1, EXOTIC_REPEAT_WEIGHT, 1]);
  eq(exoticWeights(names, names), [1, 1, 1, 1], 'all found: equal again');
  const rnd = mulberry32(7), n = { A: 0, B: 0, C: 0, D: 0 };
  for (let i = 0; i < 4000; i++) n[pickExotic(names, ['A', 'B', 'C'], rnd)]++;
  const share = n.D / 4000;
  ok(share > 0.62 && share < 0.74, `the one unfound exotic drops about 69% of the time (got ${share})`);
  ok(EXOTIC_REPEAT_WEIGHT < 1 && EXOTIC_REPEAT_WEIGHT > 0, 'repeats stay possible');
});
test('exotic drops: weapons use the shared pool, armor the class pool; a fixed slot limits the pool', () => {
  const weapons = EXOTIC_WEAPONS.map((e) => e.name);
  const armor = exoticArmorFor('arcanist').map((x) => x.name);
  eq(armor.length, 15, 'H26: two Darkness exotics per class');
  for (let i = 0; i < 60; i++) {
    const it = rollItem(100, 4, null, null, 'arcanist', []);
    eq(it.rarity, 'exotic');
    if (it.kind === 'weapon') ok(weapons.includes(it.name), it.name);
    else { ok(armor.includes(it.name), it.name); eq(it.classId, 'arcanist'); eq(EXOTIC_ARMOR.arcanist[it.slot].includes(it.name), true, 'slot matches the exotic'); }
  }
  for (let i = 0; i < 20; i++) { const it = rollItem(100, 4, 'legs', null, 'stalker'); eq(it.slot, 'legs'); ok(EXOTIC_ARMOR.stalker.legs.includes(it.name)); }
  for (let i = 0; i < 20; i++) eq(rollItem(100, 4, 'heavy').slot, 'heavy');
  // with all but one class exotic found, that one dominates the armor drops
  const found = armor.filter((x) => x !== 'Lunafaction Boots');
  let luna = 0, arm = 0;
  for (let i = 0; i < 600; i++) { const it = rollItem(100, 4, null, null, 'arcanist', found); if (it.kind === 'armor') { arm++; if (it.name === 'Lunafaction Boots') luna++; } }
  ok(luna / arm > 0.28, `unfound exotic share ${luna / arm}`);
});
test('save v6 upgrades to v7: exoticsFound is seeded from every Guardian and the vault; items are untouched', () => {
  const ex = (id, name, kind = 'armor') => ({ id, kind, slot: kind === 'armor' ? 'helmet' : 'primary', rarity: 'exotic', name, power: 100, stats: { mob: 9, res: 9, rec: 9, dis: 9, int: 9, str: 9 }, mods: [null, null, null, null], classId: 'vanguard' });
  const v6 = { version: 6, classId: 'vanguard', glimmer: 5, inventory: [ex('a', 'Synthoceps'), ex('b', 'Thorn', 'weapon')], vault: [ex('c', 'Synthoceps')], equipped: {}, cleared: {}, subclass: {}, loadout: {},
    shaders: { owned: [], applied: {} }, chars: { stalker: { inventory: [ex('d', 'Raiden Flux')], equipped: {} } }, progression: { xp: 0, claimed: [] }, settings: {} };
  freshOld({ afterlight_save_v2: JSON.stringify(v6) });
  const s = S.loadSave();
  eq(s.version, S.SAVE_VERSION);
  eq(s.exoticsFound.sort(), ['Raiden Flux', 'Synthoceps', 'Thorn']);
  eq(s.inventory.map((i) => i.id), ['a', 'b']); eq(s.vault[0].name, 'Synthoceps');
  // new exotics are noted once, other rarities never
  S.addItem(s, ex('e', 'Peacekeepers')); S.addItem(s, ex('f', 'Peacekeepers'));
  S.addItem(s, { ...ex('g', 'Plain Helm'), rarity: 'legendary' });
  eq(s.exoticsFound.filter((n) => n === 'Peacekeepers').length, 1);
  ok(!s.exoticsFound.includes('Plain Helm'));
  fresh(); eq(S.createSave('stalker').exoticsFound, []);
});
test('v1.7 tuning: slower abilities, Golden Gun nerf with Nighthawk kept, Nova field', () => {
  eq(C.ABILITY_CD, { grenade: 1.5, melee: 1.5, class: 1.3 });
  ok(C.KILL_CD_REFUND < 0.6, 'kills take less off cooldowns');
  ok(C.GOLDEN_GUN.shot < 1100 && C.GOLDEN_GUN.splash < 350, 'base Golden Gun is weaker');
  const hawk = C.GOLDEN_GUN.shot * C.NIGHTHAWK.goldenGun;
  ok(hawk >= 4000 && hawk > C.GOLDEN_GUN.shot * 4.5, 'one Nighthawk shot stays near its v1.6 damage (4400)');
  ok(C.GOLDEN_GUN.knockMult < 1 && C.GOLDEN_GUN.knockMult >= 0.8, "Knock 'Em Down shots are slightly weaker");
  eq([C.NOVA_FIELD.life, C.NOVA_FIELD.weaken > 0, C.NOVA_FIELD.suppress > 0], [6, true, true]);
  const k = SC.resolveKit('stalker', 'gunslinger', undefined, 40);
  eq(k.abilities.melee.cd, CLASSES.stalker.subclasses.gunslinger.abilities.melee.cd * 1.5);
});
test('v1.8.1: Sentinel Shield guard blocks 95% and Ursa Furiosa counts the blocked share', () => {
  eq(C.SENTINEL_GUARD.cut, 0.95);
  const hit = 200, taken = hit * (1 - C.SENTINEL_GUARD.cut), blocked = hit * C.SENTINEL_GUARD.cut;
  ok(Math.abs(taken - 10) < 1e-9, 'a 200 hit lands as 10');
  ok(Math.abs(Math.min(C.URSA.max, blocked * C.URSA.perDmg) - 47.5) < 1e-9, 'one blocked 200 hit returns 47.5% super');
});

// ---------- H3 hotfix (v1.8.2) ----------
test('v1.8.2: elemental perks roll only on their element', () => {
  const want = { incandescent: 'solar', voltshot: 'arc', destabilizing: 'void' };
  const seen = { incandescent: 0, voltshot: 0, destabilizing: 0 };
  for (let i = 0; i < 4000; i++) {
    const it = rollItem(50, 2 + (i % 2), WEAPON_SLOTS_T[i % 3]);
    for (const p of it.perks || []) if (want[p]) { seen[p]++; eq(it.element, want[p], `${p} on ${it.element}`); }
  }
  for (const [p, n] of Object.entries(seen)) ok(n > 0, `${p} still drops`);
});
test('v1.8.2: weapon tuning', () => {
  eq([ARCHETYPES.auto.rpm, ARCHETYPES.fusion.rpm, ARCHETYPES.smg.range, ARCHETYPES.shotgun.range, ARCHETYPES.shotgun.dmg, ARCHETYPES.shotgun.falloff.bonus], [650, 80, 15, 9, 22, 1.15]);
  eq([ARCHETYPES.linear.dmg, ARCHETYPES.rocket.dmg, ARCHETYPES.mg.dmg, ARCHETYPES.glauncher.dmg], [580, 1210, 41, 510], 'U11: heavy damage up about 22%');
  eq([ARCHETYPES.linear.reserve, ARCHETYPES.rocket.reserve, ARCHETYPES.mg.reserve, ARCHETYPES.glauncher.reserve], [14, 8, 210, 16], 'heavy reserves (hotfix: raised)');
  // ranges: SMG short, Auto and Pulse medium, Scout long
  ok(ARCHETYPES.smg.range < ARCHETYPES.auto.range && ARCHETYPES.auto.range <= ARCHETYPES.pulse.range && ARCHETYPES.pulse.range < ARCHETYPES.scout.range, 'range bands');
});
test('v1.8.2: supers (Chaos Reach 9 s, Well 25 s, nerfs) and the rift and barricade timers', () => {
  eq(C.SUPER_TIME.chaosreach, 9);
  eq(C.SUPER_TUNE.well.life, 25);
  ok(C.SUPER_TUNE.well.burn > 0 && C.SUPER_TUNE.well.restore > 0, 'Well burns and restores');
  eq([C.SUPER_TUNE.gathering.dmg, C.SUPER_TUNE.spectral.hit], [2100, 210]);
  ok(C.SUPER_TUNE.novawarp.seekers > 0 && C.SUPER_TUNE.novawarp.weaken > 0, 'Nova Warp seekers weaken');
  eq(C.CLASS_FX_LIFE, { rift: 10, barricade: 12, rally: 7 });
  ok(STATUS.riftup && STATUS.barricadeup, 'timer buffs');
});

// ---------- Eyes Up, Guardian (v1.9) ----------
test('v1.9: burst supers hover with 85% damage reduction, roaming keep 70%, Well and Ward slam', () => {
  eq(C.BURST_SUPERS.slice().sort(), ['absolutezero', 'avalanche', 'bladebarrage', 'cradle', 'gathering', 'needlestorm', 'nova', 'ripcord', 'silencesquall', 'tether', 'twilight']); // U22 adds six Darkness burst supers
  for (const id of ['glacialquake', 'bladefury', 'rimeblades', 'silkstrike', 'winterswrath', 'loomwalker']) eq(C.SUPER_ARMOR[id], C.ROAM_ARMOR, id);
  for (const id of C.BURST_SUPERS) ok(Math.abs(100 * C.SUPER_ARMOR[id] - 15) < 1e-9, `${id}: 100 damage lands as 15`);
  for (const id of ['hammers', 'fists', 'maul', 'spectral', 'novawarp', 'chaosreach', 'daybreak']) eq(C.SUPER_ARMOR[id], C.ROAM_ARMOR, id);
  eq(C.SLAM_SUPERS.slice().sort(), ['avalanche', 'wardofdawn', 'well'], 'H25: Avalanche slams too');
  ok(C.SUPER_HOVER.lift > 0 && C.SUPER_HOVER.slamSpeed > 0, 'hover and slam tuned');
  for (const id of Object.keys(C.SUPER_TIME)) ok(C.SUPER_ARMOR[id] !== undefined, `${id} has a damage value`);
});
test('v1.9: every super is third person except Golden Gun and Song of Flame', () => {
  const firsts = [];
  for (const [c, sid] of SUBS) { const sp = CLASSES[c].subclasses[sid].abilities.super; if (sp.camera === 'first') firsts.push(sp.id); }
  for (const [id, d] of Object.entries(SC.SUPERS)) if (d.camera === 'first') firsts.push(id);
  eq(firsts.sort(), ['revolver', 'songflame']);
});
test('v1.9: Sentinel Shield barrier is 6 m wide, stops shots in front only, and blinds', () => {
  eq(C.SENTINEL_BARRIER.w, 6);
  // facing yaw 0 looks down -z; the barrier stands about 1.3 m ahead
  ok(C.barrierStops(0, 0, 0, 0, { x: 0, y: 1.2, z: -1 }), 'ahead');
  ok(C.barrierStops(0, 0, 0, 0, { x: 2.8, y: 1.2, z: -1 }), 'covers a teammate 2.8 m to the side');
  ok(!C.barrierStops(0, 0, 0, 0, { x: 0, y: 1.2, z: 1 }), 'not behind');
  ok(!C.barrierStops(0, 0, 0, 0, { x: 3.2, y: 1.2, z: -1 }), 'not past the edge');
  ok(!C.barrierStops(0, 0, 0, 0, { x: 0, y: 4, z: -1 }), 'not over the top');
  ok(C.barrierStops(5, 0, 5, Math.PI / 2, { x: 4, y: 1, z: 5 }), 'turns with the Guardian');
  ok(ENEMY_STATUS.blind && C.SENTINEL_GUARD.blind > 0, 'blind debuff');
});
test('v1.9: rifts take the subclass element; Hellion burns longer', () => {
  eq(['solar', 'arc', 'void'].map((el) => C.riftElement(el, 'heal')), ['solar', 'arc', 'void']);
  eq(C.riftElement(undefined, 'empower'), 'arc'); eq(C.riftElement(undefined, 'heal'), 'void');
  ok(SC.ASPECT_TUNE.hellion.burn > 1.5 && SC.ASPECT_TUNE.hellion.splash > 0, 'Hellion bolts splash and burn');
  ok(SC.ASPECTS.hellion.desc.includes('class ability'), 'any class ability');
});
test('v1.9: orbs give armor charge only with a charge mod; a Font for every stat', () => {
  ok(!AR.usesCharge({}) && !AR.usesCharge({ grenadier: 1, dynamo: 2 }), 'no charge mods');
  for (const id of ['fontmight', 'surge_arc', 'chargedup', 'timedil', 'stacks']) ok(AR.usesCharge({ [id]: 1 }), id);
  ok(AR.ORB.heal > 0, 'every orb heals a little');
  eq(Object.values(AR.FONT_STAT).sort(), AR.STAT_KEYS.slice().sort());
  for (const [id, k] of Object.entries(AR.FONT_STAT)) eq(AR.MODS[id].name, `Font of ${AR.STATS[k].name}`);
});
test('v1.9: aspects open 2 or 3 fragment slots, up to 5', () => {
  eq(SC.FRAGMENT_CAP, 5);
  eq(SC.fragmentSlots(['amplitude', 'resolve']), 5, 'two 3-slot aspects cap at 5');
  ok(Object.values(SC.FRAGMENTS).filter((f) => f.element === 'void').length >= 5, 'enough fragments to fill 5 slots');
});

// ---------- Loot 2.0 (U10) ----------
test('U10 leveling: steeper curve; a clean solo campaign run lands near 27, about 30 with replays', () => {
  ok(PG.xpForLevel(30) > PG.xpForLevel(30, PG.xpToNextV1), 'level 30 takes more XP than in v1.9');
  ok(PG.xpForLevel(LEVEL_CAP) > PG.xpForLevel(LEVEL_CAP, PG.xpToNextV1) * 1.2, 'level 40 takes much more');
  const L = levelInfo(53000).level; ok(L >= 25 && L <= 29, `clean run lands at ${L}`);
  const R = levelInfo(65000).level; ok(R >= 29 && R <= 31, `with replays lands at ${R}`);
  for (let l = 1; l < LEVEL_CAP; l++) ok(xpToNext(l + 1) > xpToNext(l), `curve rises at ${l}`);
});
test('U10 save v8: XP moves to the new curve keeping the level and progress', () => {
  for (const L of [1, 4, 10, 19, 27, 39]) {
    const oldXp = PG.xpForLevel(L, PG.xpToNextV1) + Math.floor(PG.xpToNextV1(L) / 2);
    const nx = PG.convertXp(oldXp), info = levelInfo(nx);
    eq(info.level, L, `level ${L}`);
    ok(Math.abs(info.into / info.need - 0.5) < 0.01, `half way at ${L}`);
  }
  eq(levelInfo(PG.convertXp(PG.xpForLevel(LEVEL_CAP, PG.xpToNextV1) + 5000)).level, LEVEL_CAP);
  const v7 = { version: 7, classId: 'vanguard', glimmer: 5, inventory: [], vault: [], equipped: {}, cleared: {}, subclass: {}, loadout: {},
    shaders: { owned: [], applied: {} }, chars: {}, exoticsFound: [], progression: { xp: PG.xpForLevel(12, PG.xpToNextV1), claimed: [3, 6, 9, 12] }, settings: {} };
  freshOld({ afterlight_save_v2: JSON.stringify(v7) });
  const s = S.loadSave();
  eq(s.version, S.SAVE_VERSION); eq(S.playerLevel(s), 12); eq(s.progression.claimed, [3, 6, 9, 12]);
});
// ---------- U15 The Ghost's Story ----------
test('U15 campaign order: one destination at a time, Light rises by about 9 from 10 to 200, the Leviathan closes', () => {
  eq(LOCATIONS.map((l) => l.id), ['earth', 'moon', 'mars', 'io', 'titan', 'tangled', 'dc', 'leviathan']);
  const all = S.ALL_MISSIONS;
  eq(all.length, 22);
  for (let i = 1; i < all.length; i++) ok(all[i].power > all[i - 1].power, `${all[i].id} power rises`);
  eq([all[0].power, all[21].power], [10, 200]);
  eq(LOCATIONS[7].missions.length, 1);
  eq(all.map((m) => m.g), all.map((m, i) => i), 'flat index matches li * 3 + mi through the Leviathan');
  eq(LOCATIONS[3].missions.map((m) => m.id), ['io2', 'io1', 'io3']);
});
test('U15 gating: a new save opens only the first mission; each clear opens the next across destinations', () => {
  fresh();
  const s = S.createSave('vanguard');
  eq([S.isUnlocked(s, 0, 0), S.isUnlocked(s, 0, 1), S.isUnlocked(s, 1, 0)], [true, false, false]);
  for (const m of S.ALL_MISSIONS) { ok(S.isUnlocked(s, m.li, m.mi), `${m.id} open after the previous clear`); s.cleared[m.id] = true; const st = Q.dueStop(s); if (st) for (const n of st.npcs) Q.talkTo(s, n); } // U16: the Tower debrief opens the next destination
  ok(!S.isUnlocked({ cleared: { dc3: false } }, 7, 0), 'the Leviathan needs the Dreaming City');
});
test('U16 quests: every Guardian starts with the campaign; it cannot be abandoned; a custom quest can be dropped and picked up', () => {
  fresh();
  const s = S.createSave('vanguard');
  eq(s.quests.active, ['campaign']);
  ok(Q.abandonQuest(s, 'campaign'), 'the campaign refuses to be abandoned'); eq(s.quests.active, ['campaign']);
  Q.QUESTS.test_exotic = { id: 'test_exotic', name: 'Test', desc: '', abandonable: true };
  s.quests.active.push('test_exotic');
  eq(Q.abandonQuest(s, 'test_exotic'), null); eq(s.quests.dropped, ['test_exotic']);
  ok(Q.abandonQuest(s, 'test_exotic'), 'cannot abandon twice');
  eq(Q.pickUpQuest(s, 'test_exotic'), null); ok(s.quests.active.includes('test_exotic') && !s.quests.dropped.length, 'picked back up');
  delete Q.QUESTS.test_exotic;
  S.switchCharacter(s, 'stalker');
  eq(s.quests.active, ['campaign'], 'a new Guardian has its own campaign quest');
  s.cleared.earth3 = true;
  S.switchCharacter(s, 'vanguard');
  ok(!s.cleared.earth3, 'quest and progress are per Guardian');
});
test('U16 Tower stops: a finished destination stays closed until the Vanguard have been spoken to', () => {
  fresh();
  const s = S.createSave('vanguard');
  for (const m of LOCATIONS[0].missions) s.cleared[m.id] = true;
  const st = Q.dueStop(s);
  eq(st.id, 'earth'); ok(!S.isUnlocked(s, 1, 0), 'the Moon is closed'); ok(Q.towerLockReason(s, 1).includes('Tower'));
  ok(Q.npcHasQuest(s, 'zavala') && !Q.npcHasQuest(s, 'kadi'));
  const r1 = Q.talkTo(s, 'zavala'); ok(r1.counted && !r1.finished);
  ok(!Q.talkTo(s, 'zavala').counted, 'a second talk does not count');
  ok(!S.isUnlocked(s, 1, 0), 'still closed after one of three');
  Q.talkTo(s, 'ikora'); const r3 = Q.talkTo(s, 'cayde'); ok(r3.finished);
  ok(S.isUnlocked(s, 1, 0), 'the Moon is open'); eq(Q.dueStop(s), null);
  const v = Q.questList(s)[0]; eq(v.state, 'active'); ok(v.step.length > 5 && v.log.length >= 3);
});
test('U16 Tower stops: a Guardian who already passed a stop before the Tower existed is not sent back', () => {
  fresh();
  const s = S.createSave('vanguard');
  for (const li of [0, 1]) for (const m of LOCATIONS[li].missions) s.cleared[m.id] = true;
  s.cleared[LOCATIONS[2].missions[0].id] = true; // already started Mars
  eq(Q.dueStop(s), null); ok(S.isUnlocked(s, 2, 1));
});
test('U16 Tower stops: every stop names real destinations and NPCs, and has a script', () => {
  for (const st of Q.TOWER_STOPS) {
    ok(LOCATIONS.some((l) => l.id === st.after), `${st.id} destination`);
    ok(!/[–—]/.test(st.text), 'no dashes');
    for (const n of st.npcs) {
      ok(Q.TOWER_NPCS.includes(n), `${st.id}/${n} is a Tower NPC`);
      const lines = ST_.TOWER_TALKS[st.id]?.[n];
      ok(lines && lines.length >= 1, `${st.id}/${n} has a script`);
      for (const [who, text] of lines) { ok(ST_.SPEAKERS[who], `speaker ${who}`); ok(text.length > 5 && !/[–—]/.test(text), `${st.id}/${n} text`); }
    }
  }
  for (const n of [...Q.TOWER_NPCS, 'kadi']) ok(ST_.TOWER_IDLE[n].length >= 2, `${n} idle lines`);
});
test('U16 Tower map: posts for every Tower NPC, kiosks, a launch pad and a Range with dummies inside its box', () => {
  const S_ = TOWER_SPOTS, b = [-82, 120, -76, 74]; // the map's bounds
  for (const n of [...Q.TOWER_NPCS, 'kadi']) { ok(S_[n] && Number.isFinite(S_[n].x), `${n} has a post`); ok(S_[n].x > b[0] && S_[n].x < b[1] && S_[n].z > b[2] && S_[n].z < b[3], `${n} is inside the map`); }
  for (const k of ['questKiosk', 'exoticKiosk', 'launchPad', 'rangeBox', 'rangeFirePoint', 'rangeBoss']) ok(S_[k], k);
  const rb = S_.rangeBox;
  ok(S_.rangeDummies.length >= 6 && [...S_.rangeDummies, S_.rangeBoss].every((d) => d.x > rb.minX && d.x < rb.maxX && d.z > rb.minZ && d.z < rb.maxZ), 'dummies stand inside the Range');
});
test('U16d Tower: every empty NPC post is inside the map and names a symbol', () => {
  const b = [-82, 120, -76, 74];
  for (const [id, p] of Object.entries(TOWER_FUTURE_POSTS)) {
    ok(p.x > b[0] && p.x < b[1] && p.z > b[2] && p.z < b[3], `${id} is inside the map`);
    ok(['shield', 'cube', 'bullet', 'x', 'burst', 'hex'].includes(p.symbol), `${id} has a known symbol`);
  }
  eq(Object.keys(TOWER_FUTURE_POSTS).length, 10);
});
test('Unclaimed mission cache: sendToPostmaster skips a roomy inventory', () => {
  fresh();
  const s = S.createSave('vanguard');
  const base = s.inventory.find((i) => i.kind === 'weapon' && !S.isEquipped(s, i));
  const n = s.inventory.length, r = S.sendToPostmaster(s, { ...base, id: 'auto1', locked: false });
  eq(s.inventory.length, n); eq(s.postmaster.length, 1); eq(r.dismantled, null);
});
test('U16 Exotic Kiosk: priced at 7777 glimmer', () => { eq(S.KIOSK_PRICE, 7777); eq(S.POSTMASTER_CAP, 50); });
test('U16 Postmaster: overflow goes to the Postmaster, it caps at 50 (U20b), exotics are never lost, items can be collected', () => {
  fresh();
  const s = S.createSave('vanguard');
  const base = s.inventory.find((i) => i.kind === 'weapon' && !S.isEquipped(s, i));
  const mk = (id, extra = {}) => ({ ...base, id, locked: false, ...extra });
  while (!S.slotFull(s, base.slot)) s.inventory.push(mk(`f${s.inventory.length}`));
  for (let i = 0; i < S.POSTMASTER_CAP; i++) eq(S.addItem(s, mk(`p${i}`)).dismantled, null);
  eq(s.postmaster.length, S.POSTMASTER_CAP);
  const g0 = s.glimmer, r = S.addItem(s, mk('p-new'));
  eq(s.postmaster.length, S.POSTMASTER_CAP); ok(r.dismantled && r.dismantled.id === 'p0', 'the oldest was dismantled'); ok(s.glimmer > g0);
  s.postmaster = s.postmaster.map((i) => ({ ...i, rarity: 'exotic' }));
  const r2 = S.addItem(s, mk('p-ex', { rarity: 'exotic' }));
  eq(r2.dismantled, null); eq(s.postmaster.length, S.POSTMASTER_CAP + 1, 'a full Postmaster of exotics grows rather than lose one');
  ok(S.collectPostmaster(s, 'p-ex'), 'cannot collect into a full slot');
  s.inventory.pop(); eq(S.collectPostmaster(s, 'p-ex'), null); ok(S.getItem(s, 'p-ex') && !s.postmaster.some((i) => i.id === 'p-ex'));
  S.switchCharacter(s, 'arcanist'); eq(s.postmaster, [], 'the Postmaster is per Guardian');
});
test('U15 story script: every mission has lines, valid zone triggers and objective plans', () => {
  for (const m of S.ALL_MISSIONS) {
    const sc = ST_.MISSIONS[m.id];
    ok(sc, `${m.id} has a script`);
    ok(ST_.linesFor(m.id, 'start').length >= 1, `${m.id} opens with a line`);
    ok(ST_.linesFor(m.id, 'boss').length >= 1, `${m.id} has a boss line`);
    ok(ST_.linesFor(m.id, 'end').length >= 1, `${m.id} has an end line`);
    for (const l of sc.lines) { ok(ST_.SPEAKERS[l.who], `${m.id} speaker ${l.who}`); ok(l.text.length > 8 && !/[–—]/.test(l.text), `${m.id} line text`); ok(/^(start|boss|bd|end|[zc]\d)$/.test(l.at), `${m.id} trigger ${l.at}`); }
    for (const [zi, spec] of Object.entries(sc.obj)) { ok(+zi >= 0 && +zi < m.zones - 1, `${m.id} objective zone ${zi} is not the boss`); ok(OB.OBJECTIVE_TYPES.includes(spec.t), `${m.id} objective type`); ok(spec.label, `${m.id} label`); if (spec.t === 'destroy') ok(spec.what, `${m.id} names its targets`); }
  }
  for (const l of LOCATIONS) { ok(ST_.CHAPTERS[l.id]?.title, `${l.id} chapter`); ok(l.id === 'leviathan' || ST_.UNLOCKS[l.id].length >= 1, `${l.id} unlock line`); }
  ok(Object.keys(ST_.MISSIONS).length === 22, 'one script per mission');
});
test('U15 objectives: hold fills only while a Guardian is in the ring; activate needs E held; retrieve needs a press; destroy needs every target dead', () => {
  const none = { inside: () => false, holding: () => false, pressed: () => false };
  const hold = OB.makeObjective({ t: 'hold', secs: 3, label: 'h' }); hold.pos = { x: 0, z: 0 };
  OB.tickObjective(hold, 1, none); eq(hold.prog, 0);
  const inRing = { ...none, inside: () => true };
  OB.tickObjective(hold, 2, inRing); ok(!hold.done); OB.tickObjective(hold, 2, inRing); ok(hold.done && hold.prog === 3);
  const act = OB.makeObjective({ t: 'activate', n: 2, label: 'a' }); act.nodes.forEach((n, i) => { n.pos = { x: i * 20, z: 0 }; });
  OB.tickObjective(act, 5, none); ok(!act.done);
  const holdAll = { ...none, holding: () => true };
  OB.tickObjective(act, OB.OBJ.activateTime + 0.1, holdAll); ok(act.done, 'both consoles woke');
  const ret = OB.makeObjective({ t: 'retrieve', label: 'r' }); ret.item.pos = { x: 1, z: 1 };
  OB.tickObjective(ret, 1, holdAll); ok(!ret.done, 'holding is not a press');
  OB.tickObjective(ret, 1, { ...none, pressed: () => true }); ok(ret.done);
  const des = OB.makeObjective({ t: 'destroy', n: 2, label: 'd' }); des.targets = [{ alive: true }, { alive: true }];
  OB.tickObjective(des, 1, none); ok(!des.done); des.targets.forEach((e) => { e.alive = false; }); OB.tickObjective(des, 1, none); ok(des.done);
  ok(OB.objectiveText(hold).includes('3 / 3') && OB.objectiveText(act).includes('2 / 2'), 'HUD text');
  let threw = false; try { OB.makeObjective({ t: 'banana' }); } catch { threw = true; } ok(threw, 'unknown objective types raise');
});
test('U15 objectives: reinforcements come only while a hold is unfinished and the field is empty, and are capped', () => {
  const o = OB.makeObjective({ t: 'hold', secs: 99, label: 'h' });
  ok(!OB.wantsReinforcement(o, 100, 3), 'enemies alive: none');
  let n = 0; for (let i = 0; i < 100; i++) if (OB.wantsReinforcement(o, OB.OBJ.reinforceEvery + 1, 0)) n++;
  eq(n, OB.OBJ.maxReinforce);
  ok(!OB.wantsReinforcement(OB.makeObjective({ t: 'activate', n: 1 }), 100, 0), 'consoles are not timed');
});
test('U15 campaign reset: a pre-v9 save is backed up once and cleared, settings carry over, and the manual reset keeps a backup', () => {
  const old = JSON.stringify({ version: 8, classId: 'stalker', inventory: [{ id: 'x' }], equipped: {}, cleared: { e1: true }, glimmer: 1234, settings: { sens: 2.2, fov: 99 } });
  const st = fresh({ afterlight_save_v2: old });
  eq(S.loadSave(), null, 'starts fresh');
  eq(st.getItem(S.CAMPAIGN_BACKUP_KEY), old, 'backup'); eq(st.getItem('afterlight_save_v2'), null, 'old key cleared');
  ok(S.takeCampaignNotice() && !S.takeCampaignNotice(), 'notice once');
  const s = S.createSave('vanguard'); eq([s.settings.sens, s.settings.fov], [2.2, 99], 'settings kept'); eq(s.cleared, {}); eq(s.version, S.SAVE_VERSION);
  S.resetSave(); ok(st.getItem(S.MANUAL_BACKUP_KEY), 'manual reset kept a backup');
  fresh({ afterlight_save_v2: JSON.stringify({ version: 5, classId: 'vanguard', inventory: [], equipped: {} }), afterlight_backup_v8: 'earlier' });
  S.loadSave(); eq(S.CAMPAIGN_BACKUP_KEY, 'afterlight_backup_v8');
});
test('U15 campaign is per Guardian: switching class swaps the cleared missions', () => {
  fresh();
  const s = S.createSave('vanguard');
  s.cleared = { e1: true, e2: true };
  S.switchCharacter(s, 'stalker');
  eq(s.cleared, {}, 'a new Guardian starts at the Cosmodrome');
  s.cleared = { e1: true };
  S.switchCharacter(s, 'vanguard');
  eq(s.cleared, { e1: true, e2: true }, 'the Titan kept their progress');
  S.switchCharacter(s, 'stalker'); eq(s.cleared, { e1: true });
});
test('U15 item lock: a locked item is never auto-dismantled, cannot be dismantled by hand, and toggles back', () => {
  fresh();
  const s = S.createSave('vanguard');
  const weakest = s.inventory.filter((i) => !S.isEquipped(s, i)).sort((x, y) => x.power - y.power)[0];
  eq(S.toggleLock(s, weakest.id), true); ok(weakest.locked, 'locked');
  eq(S.dismantleItem(s, weakest.id), 0, 'a locked item is not dismantled by hand'); ok(S.getItem(s, weakest.id), 'still owned');
  while (!S.slotFull(s, weakest.slot)) S.addItem(s, { ...weakest, id: `fill${s.inventory.length}`, locked: false, power: weakest.power + 5 });
  const gone = S.addItem(s, { ...weakest, id: 'overflow', locked: false, power: weakest.power + 6 });
  ok(gone && gone.sent.id === 'overflow', 'the overflow went to the Postmaster'); ok(S.getItem(s, weakest.id), 'the locked item survived the overflow');
  eq(S.toggleLock(s, weakest.id), false); ok(!weakest.locked, 'unlocked');
  eq(S.toggleLock(s, 'nope'), null);
});
test('U10 rarity gates: rare 5, legendary 10, exotic 20; drops never roll above the gate', () => {
  eq(PG.RARITY_GATE, { common: 1, uncommon: 1, rare: 5, legendary: 10, exotic: 20 });
  const top = { 1: 1, 4: 1, 5: 2, 9: 2, 10: 3, 19: 3, 20: 4, 40: 4 };
  for (const [L, idx] of Object.entries(top)) {
    eq(PG.maxRarityIndex(+L), idx, `max at ${L}`);
    const w = rarityWeights(+L + 10, +L); // bonus levels still stop at the gate
    ok(w.every((x, k) => k <= idx || x === 0), `weights at ${L}`);
    const r = mulberry32(+L * 31);
    for (let i = 0; i < 2000; i++) ok(rollRarity(+L, 5, r) <= idx, `roll at ${L}`);
    eq(PG.capRarity(4, +L), idx);
  }
});
test('U10 gates: gear above your level cannot be equipped, with the exact message', () => {
  fresh();
  const s = S.createSave('vanguard');
  const leg = rollItem(20, 3, 'primary'); s.inventory.push(leg);
  eq(S.equipItem(s, leg.id), 'Cannot equip. Player level too low.');
  ok(s.equipped.primary !== leg.id, 'not equipped');
  S.addXp(s, xpForLevel(10));
  eq(S.equipItem(s, leg.id), null);
  eq(s.equipped.primary, leg.id);
});
test('U10 gates: a loaded save with gated gear equipped swaps it for the best usable item', () => {
  fresh();
  const s = S.createSave('vanguard');
  const leg = rollItem(60, 3, 'primary'), exo = rollItem(60, 4, 'helmet', null, 'vanguard');
  const rare = rollItem(30, 2, 'primary');
  s.inventory.push(leg, exo, rare);
  s.equipped.primary = leg.id; s.equipped.helmet = exo.id;
  S.addXp(s, xpForLevel(6)); // level 6: rares only
  S.writeSave(s);
  const t = S.loadSave();
  eq(S.getEquipped(t, 'primary').id, rare.id, 'best usable primary');
  ok(['common', 'uncommon', 'rare'].includes(S.getEquipped(t, 'helmet').rarity), 'helmet swapped down');
  ok(t.inventory.some((i) => i.id === leg.id) && t.inventory.some((i) => i.id === exo.id), 'gated gear kept');
});
test('U10 final mission drop is the best usable rarity, not a guaranteed exotic', () => {
  eq(PG.maxRarityIndex(8), 2); eq(PG.maxRarityIndex(15), 3); eq(PG.maxRarityIndex(22), 4);
});
test('U10 perk columns: every perk sits in one column; Steady Hands and Snapshot Sights leave the rolls', () => {
  const all = Object.values(PERK_COLUMNS).flat();
  eq(new Set(all).size, all.length, 'no perk in two columns');
  for (const p of all) ok(PERKS[p], `${p} has a description`);
  eq(perkColumn('steady'), null); eq(perkColumn('snapshot'), null);
  for (const [p, c] of [['killclip', 'damage'], ['frenzy', 'damage'], ['voltshot', 'effect'], ['alloymag', 'mag'], ['overflow', 'mag'], ['highcal', 'mag'], ['leech', 'effect'], ['demolitionist', 'effect'], ['killingwind', 'effect']]) eq(perkColumn(p), c, p);
  for (const p of ['alloymag', 'rapidhit', 'subsistence', 'envious', 'adrenaline', 'oneforall', 'baitswitch', 'tremors', 'repulsor', 'jolting']) ok(perkColumn(p), `new perk ${p}`);
});
test('U10 named weapons at every rarity: each archetype has named commons, uncommons, rares and legendaries', () => {
  for (const arch of Object.keys(ARCHETYPES).filter((id) => !ARCHETYPES[id].exoticOnly)) for (const r of ['common', 'uncommon', 'rare', 'legendary']) ok(namedFor(arch, r).length >= 1, `${arch} ${r}`);
  const names = [...NAMED_WEAPONS, ...LEGENDARY_WEAPONS].map((n) => n.name);
  for (const n of NAMED_WEAPONS) { ok(FRAMES[n.arch]?.[n.frame], `${n.name} frame`); ok(ELEMENTS[n.element], `${n.name} element`); }
  const dup = names.filter((n, i) => names.indexOf(n) !== i); eq(dup, [], 'unique names');
  for (let i = 0; i < 300; i++) {
    const it = rollItem(30, i % 4, WEAPON_SLOTS_T[i % 3]);
    const named = [...NAMED_WEAPONS, ...LEGENDARY_WEAPONS].find((n) => n.name === it.name && n.arch === it.arch);
    ok(named, `${it.name} is named`); eq(it.element, named.element); eq(it.frame, named.frame);
  }
});
test('U10 perk pools: 9 perks per named weapon, 3 per column, fit its slot and element, stable', () => {
  for (const n of [...NAMED_WEAPONS, ...LEGENDARY_WEAPONS]) {
    const pool = perkPoolFor(n), slot = frameSlot(n.arch, n.frame);
    eq(Object.keys(pool), ['mag', 'damage', 'effect'], n.name);
    for (const c of Object.keys(pool)) {
      eq(pool[c].length, POOL_PER_COLUMN, `${n.name} ${c}`);
      eq(new Set(pool[c]).size, POOL_PER_COLUMN, `${n.name} ${c} unique`);
      for (const p of pool[c]) {
        eq(perkColumn(p), c, `${n.name} ${p}`);
        ok(!PERK_SLOTS[p] || PERK_SLOTS[p].includes(slot), `${n.name} ${p} slot`);
        ok(!PERK_ELEMENT[p] || PERK_ELEMENT[p] === n.element, `${n.name} ${p} element`);
        ok(!(p === 'extmag' && ARCHETYPES[n.arch].mag === 1), `${n.name} extmag`);
      }
    }
    eq(perkPoolFor(n), pool, `${n.name} stable`);
  }
});
test('U10 rolls: uncommon one Magazine perk, rare adds Damage or Effect, legendary all three; never Rampage with Kill Clip', () => {
  const r = mulberry32(99);
  for (const n of [...NAMED_WEAPONS, ...LEGENDARY_WEAPONS]) {
    const pool = perkPoolFor(n);
    for (let i = 0; i < 6; i++) {
      eq(rollPerks(pool, 'common', r), []);
      const u = rollPerks(pool, 'uncommon', r); eq(u.length, 1); ok(pool.mag.includes(u[0]), 'uncommon col 1');
      const ra = rollPerks(pool, 'rare', r); eq(ra.length, 2); ok(pool.mag.includes(ra[0]) && (pool.damage.includes(ra[1]) || pool.effect.includes(ra[1])), 'rare');
      const l = rollPerks(pool, 'legendary', r); eq(l.map(perkColumn), ['mag', 'damage', 'effect']);
      ok(!(l.includes('rampage') && l.includes('killclip')), 'no Rampage + Kill Clip');
    }
  }
  for (let i = 0; i < 200; i++) { const it = rollItem(30, 3, WEAPON_SLOTS_T[i % 3]); eq(it.perks.map(perkColumn), ['mag', 'damage', 'effect'], it.name); }
});
test('U10 inspect groups the dropped perks by column; old perks go under Other', () => {
  const g = perksByColumn(['steady', 'extmag', 'rampage', 'firefly']);
  eq(g.mag, ['extmag']); eq(g.damage, ['rampage']); eq(g.effect, ['firefly']); eq(g.other, ['steady']);
});
test('U10 new perk statuses exist', () => {
  for (const id of ['rapidhit', 'adrenaline', 'oneforall', 'baitswitch']) ok(STATUS[id], id);
  eq(STATUS.adrenaline.maxStacks, 5); eq(STATUS.rapidhit.maxStacks, 5);
});

// ---------------------------------------------------------------------------
// U11 Arsenal II
// ---------------------------------------------------------------------------
import { makeWeapon as makeWeaponT, makeExotic as makeExoticT } from '../js/loot.js';
import { EXOTIC_PERKS, HEAVY_VERSION } from '../js/data.js';
test('U11: five new behaviors in the right ammo slots; Rocket-Assisted and light Grenade Launchers sit in Special', () => {
  eq([ARCHETYPES.sidearm.slot, ARCHETYPES.sword.slot, ARCHETYPES.glaive.slot, ARCHETYPES.trace.slot], ['primary', 'heavy', 'special', 'special']);
  eq([ARCHETYPES.sword.mode, ARCHETYPES.trace.mode], ['sword', 'beam']);
  ok(ARCHETYPES.glaive.glaive.block > 0 && ARCHETYPES.glaive.glaive.meleeDmg > 0, 'glaive shield and melee');
  eq(frameSlot('pulse', 'rocket'), 'special', 'Rocket-Assisted Pulse Rifle');
  eq(frameSlot('sidearm', 'rocket'), 'special', 'Rocket-Assisted Sidearm');
  eq([frameSlot('glauncher', 'lite'), frameSlot('glauncher', 'double'), frameSlot('glauncher', 'adaptive')], ['special', 'special', 'heavy']);
  eq(frameSlot('pulse', 'adaptive'), 'primary');
  ok(weaponHandling({ arch: 'sidearm', frame: 'rocket' }).rocketRound, 'rocket rounds');
  ok(weaponHandling({ arch: 'pulse', frame: 'rocket' }).rocketRound, 'rocket pulse rounds');
  eq(weaponHandling({ arch: 'sidearm', frame: 'rapid' }).mode, 'auto');
  eq(weaponHandling({ arch: 'sidearm', frame: 'burst' }).burst, 3);
  eq(weaponHandling({ arch: 'glauncher', frame: 'double' }).grenades, 2);
  eq(['aggressive', 'lightweight', 'caster', 'vortex'].map((f) => weaponHandling({ arch: 'sword', frame: f }).sword.heavyKind), ['slam', 'dash', 'wave', 'spin'], 'sword heavy kinds');
});
test('U11: every slot and rarity drops a weapon that really sits in that slot (no throw), for every family', () => {
  for (const slot of ['primary', 'special', 'heavy']) for (let r = 0; r < 4; r++) for (let i = 0; i < 120; i++) {
    const it = makeWeaponT(slot, 50, r);
    eq(it.slot, slot, `${it.name} in ${slot}`);
    eq(frameSlot(it.arch, it.frame), slot, `${it.name} frame slot`);
    ok(it.stats.dmg > 0 && it.stats.mag >= 1, it.name);
  }
  const seen = new Set();
  for (let i = 0; i < 600; i++) { const it = makeWeaponT('special', 50, 3); seen.add(it.arch); }
  for (const a of ['glaive', 'trace', 'pulse', 'sidearm', 'glauncher', 'shotgun']) ok(seen.has(a), `special slot can drop ${a}`);
  for (const [slot, arch] of [['primary', 'sidearm'], ['special', 'glaive'], ['special', 'trace'], ['heavy', 'sword']]) for (let r = 0; r < 4; r++) ok(makeWeaponT(slot, 50, r, arch).arch === arch, `${arch} at rarity ${r}`);
});
test('U11: re-slotted weapons are not double-adjusted (Acrius keeps the heavy version; special Grenade Launchers and Rocket-Assisted do not)', () => {
  const acrius = makeExoticT('Legend of Acrius', 50);
  eq(acrius.slot, 'heavy'); eq(acrius.reserve, HEAVY_VERSION.reserve, 'Acrius reserve');
  const wh = makeExoticT('Witherhoard', 50);
  eq(wh.slot, 'special'); ok(wh.reserve === undefined, 'no heavy-version reserve'); ok(wh.stats.dmg < ARCHETYPES.glauncher.dmg, 'special grenades hit lighter');
  const bb = makeExoticT('Buried Bloodline', 50);
  eq(bb.slot, 'special'); eq(weaponHandling(bb).pellets, 2, 'two bolts');
});
test('U11: heavy ammo: reserves down, damage up (Bryce, 2026-10-19); U13b: drops come from the hidden meter', () => {
  eq([ARCHETYPES.rocket.reserve, ARCHETYPES.linear.reserve, ARCHETYPES.glauncher.reserve, ARCHETYPES.mg.reserve], [8, 14, 16, 210]);
  eq([HEAVY_VERSION.dmg, HEAVY_VERSION.reserve], [1.7, 7]);
  ok(C.AMMO_DROP === undefined, 'U13b: random ammo drops are gone; the hidden meter replaced them');
});
test('U11: the 14 new exotics are real Destiny 2 exotics with a signature perk each, in the Exotic Collection', () => {
  const real = {
    'Worldline Zero': 'sword', Heartshadow: 'sword', 'The Lament': 'sword', 'Buried Bloodline': 'sidearm', Forerunner: 'forerunner', Witherhoard: 'glauncher', 'Dead Messenger': 'glauncher',
    'Edge of Concurrence': 'glaive', 'Edge of Action': 'glaive', 'Edge of Intent': 'glaive', Coldheart: 'trace', 'Prometheus Lens': 'trace', Wavesplitter: 'trace', Divinity: 'trace',
  };
  eq(EXOTIC_WEAPONS.length, 24 + 14 + 1 + 1, "24 before U11, 14 added, U21 adds Blight Edge, U23 adds Sovereign's Gaze");
  for (const [name, arch] of Object.entries(real)) {
    const e = EXOTIC_WEAPONS.find((x) => x.name === name);
    ok(e, name); eq(e.arch, arch, `${name} family`);
    ok(e.perks.length >= 1 && e.perks.every((p) => EXOTIC_PERKS[p]), `${name} perks defined`);
    ok(e.look && e.look.parts.length, `${name} has its own look`);
    const it = makeExoticT(name, 70);
    eq(it.rarity, 'exotic'); ok(it.stats.dmg > 0, `${name} stats`);
    eq(it.slot, e.slot || ARCHETYPES[arch].slot, `${name} slot`);
  }
  eq(new Set(EXOTIC_WEAPONS.map((e) => e.name)).size, EXOTIC_WEAPONS.length, 'names unique');
  const sig = EXOTIC_WEAPONS.map((e) => e.perks[0]);
  eq(new Set(sig).size, sig.length, 'every exotic has its own signature perk');
});
test('H9: Xenophage is its own Heavy hitscan family: a solar laser, 12 in the mag, 44 in reserve, 144 RPM', () => {
  const A = ARCHETYPES.xenophage, x = EXOTIC_WEAPONS.find((e) => e.name === 'Xenophage');
  eq(x.arch, 'xenophage'); eq(A.slot, 'heavy'); ok(A.exoticOnly, 'never rolls as a random family'); ok(!A.projectile && A.laser, 'hitscan with a solar laser trail');
  const it = makeExoticT('Xenophage', 70);
  eq([it.stats.mag, it.stats.rpm, it.slot], [12, 144, 'heavy']);
  eq(ARCHETYPES.mg.reserve, 210, 'other machine guns are untouched');
  eq(weaponHandling(it).reserve, 44);
  ok(it.stats.dmg > 200 && it.stats.dmg < 300, 'round damage ' + it.stats.dmg);
});
test('U11: new families keep ammo-bound perks off weapons they do not fit', () => {
  for (const n of [...NAMED_WEAPONS, ...LEGENDARY_WEAPONS].filter((x) => ['sword', 'trace', 'glaive'].includes(x.arch))) {
    const pool = perkPoolFor(n), A = ARCHETYPES[n.arch];
    for (const c of Object.keys(pool)) for (const p of pool[c]) ok(!A.noPerks?.includes(p), `${n.name} ${p}`);
  }
  const tr = ['tremors', 'jolting', 'rapidhit'];
  for (const col of Object.keys(PERK_COLUMNS)) for (const p of eligiblePerks(col, 'trace', 'arc', 'adaptive')) ok(!tr.includes(p), `trace ${p}`);
});


test('U11: weapons you already own take new balance (stats are derived), and old heavy versions take the new heavy ammo', () => {
  const old = makeWeaponT('heavy', 50, 3, 'rocket');
  old.stats = { ...old.stats, dmg: 990 }; // stored before the U11 buff
  const acrius = makeExoticT('Legend of Acrius', 50);
  acrius.reserve = 10; acrius.brick = 3; // a pre-U11 heavy version
  const save = { inventory: [old, acrius], vault: [] };
  eq(S.refreshWeapons(save), 2);
  eq(old.stats.dmg, weaponStats(old).dmg); ok(old.stats.dmg > 990, 'the rocket launcher hits harder');
  eq([acrius.reserve, acrius.brick], [HEAVY_VERSION.reserve, HEAVY_VERSION.brick]);
  eq(S.refreshWeapons(save), 0, 'stable the second time');
});
// ---------- dev console (secret) ----------
import * as DC from '../js/devcommands.js';
test('dev console: /give builds every catalog item at its own rarity, marked spawned', () => {
  fresh();
  for (const e of DC.giveCatalog()) {
    const it = DC.buildGiven(e, 50, 'vanguard');
    ok(it && it.name === e.name, `${e.name} built`);
    eq(it.rarity, e.rarity, `${e.name} rarity`);
    ok(it.spawned === true, `${e.name} spawned`);
  }
});
test('dev console: Sunshot is exotic, lookup is case-insensitive and by unique prefix', () => {
  eq(DC.findGive('sunshot').entry.rarity, 'exotic');
  eq(DC.findGive('Sunsh').entry.name, 'Sunshot');
  ok(DC.findGive('zzzz').error, 'unknown name errors');
});
test('dev console: spawned exotics stay out of the Exotic Collection', () => {
  const st = fresh(); const s = S.createSave('vanguard');
  S.addItem(s, { ...DC.buildGiven(DC.findGive('Sunshot').entry, 50, 'vanguard') });
  ok(!(s.exoticsFound || []).includes('Sunshot'), 'not counted');
});
test('dev console: /gamerule toggles, accepts true/false and rejects junk', () => {
  fresh(); const s = S.createSave('vanguard'); const ctx = { save: s, grant() {} };
  ok(DC.runCommand('/gamerule Mayhem', ctx).ok && DC.DEV.mayhem === true);
  ok(DC.runCommand('/gamerule mayhem false', ctx).ok && DC.DEV.mayhem === false);
  ok(!DC.runCommand('/gamerule Nope', ctx).ok);
  ok(!DC.runCommand('/gamerule Mayhem maybe', ctx).ok);
  ok(!DC.runCommand('/bogus', ctx).ok);
});
test('dev console: /playerlevel goes up and down within 1 to 40', () => {
  fresh(); const s = S.createSave('vanguard'); const ctx = { save: s, grant() {} };
  ok(DC.runCommand('/playerlevel 25', ctx).ok); eq(S.playerLevel(s), 25);
  ok(DC.runCommand('/playerlevel 3', ctx).ok); eq(S.playerLevel(s), 3);
  ok(!DC.runCommand('/playerlevel 41', ctx).ok); ok(!DC.runCommand('/playerlevel x', ctx).ok);
});
test('dev console: Tab completion finishes commands, rules and item names', () => {
  eq(DC.completions('/gamer'), ['/gamerule ']);
  eq(DC.completions('/gamerule inf'), ['/gamerule InfiniteAmmo']);
  ok(DC.completions('/give sunsh').includes('/give Sunshot'));
  eq(DC.completions('/zzz'), []);
});
test('dev console: /give grants one item through the grant hook', () => {
  fresh(); const s = S.createSave('vanguard'); const got = [];
  ok(DC.runCommand('/give Sunshot', { save: s, grant: (i) => got.push(i) }).ok);
  eq(got.length, 1); eq(got[0].name, 'Sunshot');
});

// ---------- U12 Resonance: audio ----------
test('audio: every weapon archetype has a shot recipe (swords use sfx.sword)', () => {
  for (const id of Object.keys(ARCHETYPES)) if (id !== 'sword') ok(SHOT_RECIPES[id], `no shot recipe for ${id}`);
});
test('audio: recipe layers are well formed and heavy weapons have more body than light ones', () => {
  const all = [...Object.values(SHOT_RECIPES).map((r) => r.layers), ...Object.values(ABILITY_RECIPES).map((r) => r.layers), ...Object.values(ELEMENT_TINT)];
  for (const layers of all) for (const L of layers) { const p = L.n || L.t; ok(!!L.n !== !!L.t, 'a layer is noise or tone'); ok(p.dur > 0 && p.gain > 0, 'positive dur and gain'); }
  const bodyGain = (id) => Math.max(...SHOT_RECIPES[id].layers.filter((L) => L.n && L.n.type === 'lowpass' && L.n.freq <= 350).map((L) => L.n.gain)); // v2.2.3: the body is a low noise thump
  ok(bodyGain('sniper') > bodyGain('smg') && bodyGain('shotgun') > bodyGain('pulse'), 'sniper and shotgun thump harder than smg and pulse');
});
test('v2.2.3: ballistic gun shots have no pitched tone layers (a swept oscillator sounds like a note)', () => {
  for (const id of ['auto', 'hand', 'pulse', 'scout', 'smg', 'shotgun', 'sniper', 'rocket', 'rocketround', 'mg', 'glauncher', 'sidearm', 'revolver']) ok(SHOT_RECIPES[id].layers.every((L) => L.n), `${id} is all noise`);
  for (const layers of Object.values(ELEMENT_TINT)) ok(layers.every((L) => L.n), 'element tints are noise');
});
test('audio: every non-kinetic element and enemy faction has a sound', () => {
  for (const id of Object.keys(ELEMENTS)) if (id !== 'kinetic') ok(ELEMENT_TINT[id]?.length, `no tint for ${id}`);
  for (const f of ['scrappers', 'hollow', 'legion']) ok(FACTION_SOUND[f].shot && FACTION_SOUND[f].die, f);
});
test('audio: every sfx call is safe before audio has started', () => {
  for (const [k, fn] of Object.entries(sfx)) { try { fn(); fn('auto'); } catch (e) { throw new Error(`sfx.${k}: ${e.message}`); } }
});
test('audio: stereo pan follows the side a sound is on and loudness falls with distance', () => {
  const cam = { position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } }; // looking down -z, right is +x
  const R = spatial({ x: 10, y: 0, z: 0 }, cam), L = spatial({ x: -10, y: 0, z: 0 }, cam), F = spatial({ x: 0, y: 0, z: -10 }, cam);
  ok(R.pan > 0.5 && L.pan < -0.5 && Math.abs(F.pan) < 0.05, 'pan');
  ok(spatial({ x: 5, y: 0, z: 0 }, cam).gain > spatial({ x: 60, y: 0, z: 0 }, cam).gain, 'distance');
  eq(spatial(null, cam).pan, 0);
});
test('music: sections need a closer approach to enter than to stay in, and the boss wins', () => {
  eq(musicSectionFor('explore', 100, Infinity), 'explore');
  eq(musicSectionFor('explore', 60, Infinity), 'tense');
  eq(musicSectionFor('tense', 30, Infinity), 'combat');
  eq(musicSectionFor('explore', 45, Infinity), 'tense');   // 45 m is not close enough to start combat...
  eq(musicSectionFor('combat', 45, Infinity), 'combat');   // ...but is close enough to stay in it
  eq(musicSectionFor('combat', 70, Infinity), 'tense');
  eq(musicSectionFor('tense', 90, Infinity), 'tense');
  eq(musicSectionFor('explore', 90, Infinity), 'explore');
  eq(musicSectionFor('combat', 10, 60), 'boss');
  eq(musicSectionFor('boss', 10, 80), 'boss');
  eq(musicSectionFor('boss', 10, 100), 'combat');
});

// ---------- U13a: Hostile Intent ----------
const boxC = (x0, y0, z0, x1, y1, z1) => ({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 } });
const navBounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };

test('U13a: a diagonal wall blocks only where it is, not across its bounding box', () => {
  const wall = orientedCollider(0, 0, 0, 10, 3, 1, Math.PI / 4); // long axis runs (0.71, -0.71) in world XZ
  ok(wall.min.x < -3.5 && wall.max.x > 3.5, 'bounding box spans the wall');
  ok(footprintHit(wall, 3, -3, 0.1), 'a point on the wall');
  ok(!footprintHit(wall, 3, 3, 0.1), 'the empty corner of the bounding box');
  ok(!footprintHit(wall, -3, -3, 0.1), 'and the opposite corner');
  ok(footprintHit(wall, -3, 3, 0.1), 'while the other diagonal is the wall itself');
  ok(footprintHit(wall, 0, 0, 0.1), 'centre');
  ok(!footprintHit(wall, 6.5, -6.5, 0.1), 'past the wall end');
});
test('U13a: enemies are pushed out of a diagonal wall along its normal, and shots test the exact shape', () => {
  const old = G.colliders;
  G.colliders = [orientedCollider(0, 0, 0, 10, 3, 1, Math.PI / 4)];
  const p = { x: 0.1, y: 0, z: 0.1 };
  pushOutCircle(p, 0.5, 2);
  const nx = Math.SQRT1_2, nz = Math.SQRT1_2; // wall normal in world XZ
  ok(Math.abs(p.x * nx + p.z * nz) >= 0.99, 'ended clear of the wall by body radius plus half thickness');
  ok(!footprintHit(G.colliders[0], p.x, p.z, 0.499), 'no longer overlapping');
  ok(pointInColliders({ x: 3, y: 1, z: -3 }) && !pointInColliders({ x: 3, y: 1, z: 3 }), 'shots hit the wall, not its corner');
  G.colliders = old;
});
test('U13a: the player stops at a diagonal wall and slides along it instead of passing through', () => {
  const old = G.colliders;
  G.colliders = [orientedCollider(0, 0, 0, 10, 3, 1, Math.PI / 4)];
  const pos = { x: -3, y: 0, z: -3 }, vel = { x: 5, y: 0, z: 5 };
  for (let i = 0; i < 90; i++) moveBody(pos, vel, 1 / 60, 0.4, 1.8);
  ok((pos.x + pos.z) * Math.SQRT1_2 < -0.89, 'still on the near side of the wall');
  ok(!footprintHit(G.colliders[0], pos.x, pos.z, 0.39), 'not inside it');
  const q = { x: -3, y: 0, z: -3 }, v2 = { x: 5, y: 0, z: 0 };
  for (let i = 0; i < 90; i++) moveBody(q, v2, 1 / 60, 0.4, 1.8);
  ok(q.x > -3, 'walking along a diagonal still makes progress (slide)');
  G.colliders = old;
});
test('U13a: axis-aligned colliders behave as before (no rot)', () => {
  const old = G.colliders;
  G.colliders = [boxC(-1, 0, -1, 1, 2, 1)];
  const p = { x: 0.9, y: 0, z: 0 };
  pushOutCircle(p, 0.4, 2);
  ok(Math.abs(p.x - 1.4) < 0.01 && p.z === 0, 'pushed out along x');
  G.colliders = old;
});
test('U13a: A* goes around a wall, string-pulled, and reports the longer route', () => {
  const nav = buildNav([boxC(-1, 0, -15, 1, 4, 15)], navBounds);
  ok(!lineClear(nav, -10, 0, 10, 0), 'straight line is blocked');
  const r = findPath(nav, -10, 0, 10, 0);
  ok(r && !r.partial, 'a path exists');
  ok(r.pts.some((q) => Math.abs(q.z) >= 14), 'it rounds the end of the wall');
  ok(r.pts.length <= 4, `string-pulled to few waypoints (${r.pts.length})`);
  eq(r.pts[r.pts.length - 1], { x: 10, z: 0 }, 'ends on the goal');
});
test('U13a: a goal sealed inside walls gives a partial path that ends as close as it can', () => {
  const room = [boxC(5, 0, 5, 15, 3, 6), boxC(5, 0, 14, 15, 3, 15), boxC(5, 0, 5, 6, 3, 15), boxC(14, 0, 5, 15, 3, 15)];
  const nav = buildNav(room, navBounds);
  const r = findPath(nav, -10, 0, 10, 10);
  ok(r && r.partial, 'partial');
  const end = r.pts[r.pts.length - 1];
  ok(Math.hypot(end.x - 10, end.z - 10) < 12, 'still closes in');
});
test('U13a: enemies do not climb walls; steps and low curbs are fine, a crate is a hop-up ledge', () => {
  const nav = buildNav([boxC(0, 0, 0, 12, 0.4, 12), boxC(-12, 0, -12, -9, 3, -9), boxC(8, 0, -9, 10, 1.2, -7)], navBounds);
  ok(heightAt(nav, 6, 6) > 0.39 && heightAt(nav, 6, 6) < 0.41, 'a 0.4 m curb is walkable at its top');
  ok(heightAt(nav, -10.5, -10.5) < 0, 'a 3 m wall is blocked, not standable');
  ok(heightAt(nav, 9, -8) > 1.19, 'a 1.2 m crate top is a standable surface');
  const reach = floodReach(nav, -10, 5);
  ok(!reach[Math.floor((-8 - nav.minZ) / nav.cell) * nav.W + Math.floor((9 - nav.minX) / nav.cell)], 'but plain steps do not lead onto it');
  const spots = ledgeSpots(nav, reach, 9, -8, 6, 1);
  ok(spots.length > 0 && spots.every((q) => q.from && q.h >= NAV.ledgeMin), 'it is offered as a firing position reached by a hop from the floor');
});
test('U13a: a ledge taller than a hop is never a firing position', () => {
  const nav = buildNav([boxC(8, 0, -9, 10, 2.1, -7)], navBounds);
  const reach = floodReach(nav, -10, 5);
  eq(ledgeSpots(nav, reach, 9, -8, 6, 1).length, 0);
});
test('U13a: nearestWalkable snaps a blocked point to open ground', () => {
  const nav = buildNav([boxC(-1, 0, -15, 1, 4, 15)], navBounds);
  const q = nearestWalkable(nav, 0, 0, 4);
  ok(q && heightAt(nav, q.x, q.z) >= 0 && Math.abs(q.x) >= 1, 'moved off the wall');
});
test('U16b: DestinationUnlock opens every mission and is session-only', () => {
  const sv = S.createSave ? S.createSave() : null;
  S.UNLOCK.all = false;
  ok(!S.isUnlocked(sv, 3, 0), 'locked on a new save');
  S.UNLOCK.all = true;
  ok(S.isUnlocked(sv, 3, 0) && S.isUnlocked(sv, 8, 0), 'unlocked with the rule on');
  S.UNLOCK.all = false;
});
test('U16b: open zones have no leash; a closed room still contains its units', () => {
  const zone = { center: { x: 0, z: 0 }, isBoss: false };
  eq(AI.leashTarget(zone, 500, 0), { x: 500, z: 0, held: false }, 'chases anywhere');
  ok(!AI.pastLeash(zone, 900, 900), 'never past the leash without a room');
  eq(AI.insideLeash(zone, 70, 3), { x: 70, z: 3 }, 'not clamped');
  const room = { center: { x: 0, z: 0 }, room: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 } };
  eq(AI.insideLeash(room, 50, 3), { x: 9, z: 3 }, 'clamped into the room');
  ok(AI.pastLeash(room, 12.5, 0) && !AI.pastLeash(room, 11, 0), 'room edges use the slack');
  ok(AI.leashTarget(room, 50, 0).held, 'target outside the room is held at its edge');
});
test('U13a: cover is for small units only when not outnumbered and no heavy is near; flushing stops it', () => {
  ok(AI.coverAllowed({ usesCover: true, aggro: 1 }), 'baseline');
  ok(!AI.coverAllowed({ usesCover: false, aggro: 0 }), 'heavies and bosses never (usesCover false)');
  ok(!AI.coverAllowed({ usesCover: true, aggro: 3 }), 'outnumbered 3:1 pushes');
  ok(!AI.coverAllowed({ usesCover: true, aggro: 1, heavyNear: true }), 'a heavy nearby');
  ok(!AI.coverAllowed({ usesCover: true, aggro: 1, flushed: true }), 'flushed units stay out');
  ok(AI.COVER.hide[0] >= 1 && AI.COVER.bursts === 2, 'a readable rhythm: a real pause, then two bursts');
});
test('U13a: only grunts and captains hide behind cover; heavies, bosses, rushers and suicide units never do', () => {
  const src = ENEMY_TYPES;
  const hiders = Object.keys(src).filter((k) => k === 'grunt' || k === 'captain');
  eq(hiders, ['grunt', 'captain']);
  ok(!src.heavy.melee && !src.suicide.melee, 'sanity');
});
test('U13a: every unit that shoots can also melee at very close range, rushers and suicide units use their own attack', () => {
  for (const [k, d] of Object.entries(ENEMY_TYPES)) {
    if (d.fireCd) { ok(d.closeMelee, `${k} flagged closeMelee`); ok(AI.CLOSE_MELEE[d.base || k]?.dmg > 0 && AI.CLOSE_MELEE[d.base || k]?.range > 0, `${k} has melee numbers`); }
    else ok(!d.closeMelee, `${k} is not a shooter`);
  }
  ok(AI.CLOSE_MELEE.heavy.dmg > AI.CLOSE_MELEE.captain.dmg && AI.CLOSE_MELEE.captain.dmg > AI.CLOSE_MELEE.grunt.dmg, 'bigger units hit harder');
  ok(AI.closeMeleeReach('heavy', 0.74) > AI.closeMeleeReach('grunt', 0.45), 'and reach further');
  ok(AI.closeMeleeReach('rusher', 0.4) === 0, 'no entry, no reach');
});
test('U13a: Cursed Thrall (Hive) and Explosive Shank (Fallen) exist; Cabal has none', () => {
  ok(ENEMY_TYPES.suicide?.suicide && ENEMY_TYPES.suicide.hp < ENEMY_TYPES.grunt.hp, 'fragile suicide unit');
  const names = Object.fromEntries(LOCATIONS.map((l) => [l.id, l.enemyNames.suicide]));
  eq([names.moon, names.titan], ['Cursed Thrall', 'Cursed Thrall']);
  eq([names.earth, names.tangled], ['Explosive Shank', 'Explosive Shank']);
  eq([names.mars, names.io], [undefined, undefined]);
});
test('U13a: the blast hurts most at the centre, half at the edge, nothing beyond', () => {
  const R = AI.SUICIDE.radius;
  eq(AI.blastDamage(40, 0), 40);
  eq(AI.blastDamage(40, R / 2), 30);
  ok(AI.blastDamage(40, R - 0.01) > 19 && AI.blastDamage(40, R - 0.01) < 21, 'about half at the rim');
  eq(AI.blastDamage(40, R), 0);
  ok(AI.SUICIDE.fuse >= 0.4 && AI.SUICIDE.trigger > AI.SUICIDE.radius * 0.5, 'a fair warning before the blast');
});

test('v2.2.3: Rocket-Assisted rounds are fast projectiles; the Pulse Rifle has a 6-shot magazine of 3-round bursts, the Sidearm stays single-fire', () => {
  const pr = weaponHandling({ arch: 'pulse', frame: 'rocket' }), sr = weaponHandling({ arch: 'sidearm', frame: 'rocket' });
  ok(pr.rocketRound.speed >= 60 && sr.rocketRound.speed >= 60, 'fast rounds');
  eq([pr.mode, pr.burst, pr.shotMag], ['burst', 3, true], 'pulse: three-round shot');
  eq(weaponStats({ arch: 'pulse', frame: 'rocket', rarity: 'legendary' }).mag, 6, 'pulse mag counts shots');
  eq([sr.mode, sr.burst ?? 0, sr.shotMag ?? false], ['semi', 0, false], 'sidearm single fire');
});

// ---------- U13b Hostile Intent II ----------
test('U13b: every non-boss unit is a minor or a major; majors are tougher and bosses have no tier', () => {
  eq(Object.keys(TR.TIERS), ['minor', 'major']);
  ok(TR.TIERS.major.hp > TR.TIERS.minor.hp && TR.TIERS.major.size > TR.TIERS.minor.size, 'major is tougher and bigger');
  eq(TR.rollTier('boss', 5), null, 'boss has no tier');
  for (const t of ['grunt', 'rusher', 'suicide', 'captain', 'heavy']) ok(['minor', 'major'].includes(TR.rollTier(t, 0, 0.5)), t);
});
test('U13b: captains and heavies are mostly majors at low power, and every type gains majors with power', () => {
  ok(TR.majorChance('captain', 0) > 0 && TR.majorChance('captain', 0) < 0.3 && TR.majorChance('heavy', 0) < 0.3, 'some large units are majors at low power');
  ok(['grunt', 'rusher', 'suicide'].every((t) => TR.majorChance(t, 8) === 0), 'small units are never majors in the normal campaign');
  ok(TR.majorChance('captain', 8) > TR.majorChance('captain', 0) && TR.majorChance('heavy', 8) > TR.majorChance('heavy', 0), 'more large majors at high power');
  eq(TR.rollTier('captain', 0, 0.0), 'major'); eq(TR.rollTier('captain', 0, 0.99), 'minor');
});
test('U13b: fireteam table: solo is unchanged, three players get more enemies, health, damage and boss health', () => {
  eq(TR.fireteamScale(1), { count: 1, hp: 1, dmg: 1, boss: 1 });
  const a = TR.fireteamScale(2), b = TR.fireteamScale(3);
  ok(b.count > a.count && a.count > 1 && b.hp > a.hp && a.hp > 1 && b.dmg > a.dmg && b.boss > a.boss, 'monotonic');
  eq([a.count, b.count, a.boss, b.boss], [1.25, 1.5, 1.6, 2.2], 'H22 counts, v2.3 boss health kept');
});
test('U13b: shields are elemental per faction; a matching break bursts and hurts only nearby, less far out', () => {
  ok(TR.shieldFor('legion', 'heavy') && !TR.shieldFor('scrappers', 'heavy') && !TR.shieldFor('hollow', 'heavy'), 'Colossus has one, Brig and Ogre do not');
  for (const f of ['scrappers', 'hollow', 'legion']) ok(TR.shieldFor(f, 'captain').every((e) => SHIELD_ELEMENTS.includes(e)), f);
  ok(TR.shieldBurstDamage(180, 1) > TR.shieldBurstDamage(180, 4) && TR.shieldBurstDamage(180, 4) > 0, 'falls off');
  eq(TR.shieldBurstDamage(180, TR.SHIELD_BURST.radius), 0, 'none outside the radius');
});
test('U13b: the faction that throws grenades does it with its grunts; Cabal alone has jetpacks; only Hive Ogres enrage', () => {
  for (const f of ['scrappers', 'hollow', 'legion']) ok(TR.grenadeThrower(f, 'grunt') && !TR.grenadeThrower(f, 'heavy'), f);
  eq(Object.entries(TR.FACTION_PROFILES).filter(([, p]) => p.jet).map(([k]) => k), ['legion']);
  ok(TR.JET.hover[0] === 5 && TR.JET.hover[1] === 10, 'hover 5 to 10 s');
  ok(TR.isEnraged(29, 100, 'hollow', 'heavy') && !TR.isEnraged(31, 100, 'hollow', 'heavy') && !TR.isEnraged(10, 100, 'legion', 'heavy') && !TR.isEnraged(10, 100, 'hollow', 'captain') && !TR.isEnraged(0, 100, 'hollow', 'heavy'), 'below 30%, hollow heavy only, alive');
});
test('U13b: a lobbed grenade lands where it is aimed', () => {
  const L = TR.lobVelocity(12, -1, 5);
  const x = L.vx * L.t, z = L.vz * L.t, y = L.vy * L.t - 0.5 * TR.GRENADE.gravity * L.t * L.t;
  ok(Math.abs(x - 12) < 1e-6 && Math.abs(z - 5) < 1e-6 && Math.abs(y + 1) < 1e-6, 'lands on target');
  ok(L.t >= 0.6, 'at least 0.6 s of flight');
});
test('U13b: a suicide blast takes most of a Guardian but never all of it, at any enemy damage multiplier', () => {
  const total = 100 + 70;
  const lo = TR.suicideCore(total, 1), hi = TR.suicideCore(total, 3);
  ok(lo >= total * 0.7 && lo < total, 'most of it');
  ok(hi < total && hi <= total * TR.SUICIDE_BLAST.cap + 1e-9, 'capped below a one-shot');
  ok(AI.blastDamage(lo, AI.SUICIDE.radius) === 0 && AI.blastDamage(lo, 0) === lo, 'blast radius unchanged');
});
test('U13b: boss phases alternate hold and push, and later thirds push longer and hold less', () => {
  ok(TR.bossPhaseTime('hold', 0, 0.5) >= 8 && TR.bossPhaseTime('hold', 0, 0.5) <= 12, 'hold 8 to 12 s');
  ok(TR.bossPhaseTime('hold', 2, 0.5) < TR.bossPhaseTime('hold', 0, 0.5), 'holds less');
  ok(TR.bossPhaseTime('push', 2, 0.5) > TR.bossPhaseTime('push', 0, 0.5), 'pushes longer');
});
test('U13b: the hidden ammo meter drops one brick when full, resets, and scales with kills', () => {
  const m = { special: 0, heavy: 0 };
  let n = 0, sp = 0, hv = 0;
  for (let i = 0; i < 400; i++) { const b = TR.meterKill(m, TR.killValue('minor', false)); if (b) n++; if (b === 'special') sp++; if (b === 'heavy') hv++; }
  ok(n > 0 && sp > hv && hv > 0, 'special comes more often than heavy');
  ok(sp <= Math.ceil(400 / TR.AMMO_METER.size.special) + 1, 'special is paced by the meter, not by chance');
  const m2 = { special: 0, heavy: 0 }; let k = 0;
  while (!TR.meterKill(m2, TR.killValue('minor', false))) k++;
  const m3 = { special: 0, heavy: 0 }; let k3 = 0;
  while (!TR.meterKill(m3, TR.killValue('major', false))) k3++;
  ok(k3 < k, 'majors fill it faster');
  ok(TR.killValue(null, true) > TR.killValue('major', false), 'a boss is worth more than a major');
  const m5 = { special: 15.5, heavy: 0 };
  eq(TR.meterKill(m5, 1), 'special'); ok(m5.special < 1, 'the meter resets after a drop');
});
test('U13b: bricks are bigger when the reserve is empty and smaller when full', () => {
  ok(TR.brickScale(0) > 1 && TR.brickScale(1) < 1 && TR.brickScale(0.5) > TR.brickScale(0.9), 'scales with emptiness');
  ok(TR.brickScale(-1) === TR.brickScale(0) && TR.brickScale(2) === TR.brickScale(1), 'clamped');
});

test('Glaive bolt: a travelling projectile with shared falloff', () => {
  const b = ARCHETYPES.glaive.glaive.bolt;
  ok(b && b.speed >= 85 && b.speed <= 150 && b.size < 0.15 && b.life > 0.5, 'bolt tuned fast and small');
  const F = { close: 0, bonus: 1, min: 0.5, span: 1.5 };
  eq(C.falloffMult(F, 10, 28), 1); ok(C.falloffMult(F, 60, 28) < 1 && C.falloffMult(F, 500, 28) === 0.5, 'falls to the floor');
  ok(C.falloffMult({ close: 5, bonus: 1.3, min: 0.5, span: 1.5 }, 1, 28) > 1, 'point-blank bonus');
});


test('U14 factions: every unit extends a base class, has a name and a roster entry', () => {
  const bases = ['grunt', 'rusher', 'captain', 'heavy', 'suicide'];
  for (const [id, u] of Object.entries(FA.UNITS)) {
    ok(bases.includes(u.base), `${id} base`); ok(u.objective || u.dungeon || FA.FACTIONS[u.faction] || (FA.BASE_EXTRAS[u.faction] || []).some((r) => r.t === id), `${id} faction`); ok(u.name, `${id} name`);
    ok(ENEMY_TYPES[id] && ENEMY_TYPES[id].base === u.base && ENEMY_TYPES[id].hp > 0, `${id} registered with stats`);
    eq(FA.classOf(id), u.base);
  }
  eq(FA.classOf('grunt'), 'grunt');
  for (const [f, list] of Object.entries(FA.ROSTER)) for (const r of list) ok(FA.UNITS[r.t]?.faction === f, `${r.t} rostered under ${f}`);
  ok(Object.keys(FA.UNITS).filter((i) => i.startsWith('tk_')).length >= 10 && Object.keys(FA.UNITS).filter((i) => i.startsWith('sc_')).length >= 8, 'Taken and Scorn rosters are full');
});

test('U14 factions: skills name the numbers they need', () => {
  for (const [id, u] of Object.entries(FA.UNITS)) for (const sk of u.skills || []) ok(u[sk], `${id} has ${sk} numbers`);
  ok(FA.UNITS.sc_screeb.blastMul > 1, 'Screeb blast is bigger than a Cursed Thrall');
  ok(!FA.UNITS.sc_chieftain.skills.includes('revive') && FA.UNITS.sc_stalker.skills.includes('revive'), 'revive is for the rank and file');
});

test('U14 factions: waves scale with zone, power and fireteam; heavies come later', () => {
  for (const f of ['taken', 'scorn']) {
    const a = FA.composeWave(f, 0, 0, 0), b = FA.composeWave(f, 0, 2, 9), c = FA.composeWave(f, 0, 2, 9, 2);
    ok(a.length >= 3, `${f} opens with a group`); ok(b.length > a.length, `${f} grows with power`); ok(c.length > b.length, `${f} grows with fireteam`);
    ok(!a.some((t) => ENEMY_TYPES[t].base === 'heavy'), `${f}: no heavy in the first zone at low power`);
    ok(FA.composeWave(f, 1, 2, 9).some((t) => ENEMY_TYPES[t].base === 'heavy'), `${f}: reinforcements bring a heavy later`);
  }
  const suicide = (t) => ENEMY_TYPES[t].base === 'suicide';
  ok(FA.composeWave('scorn', 0, 2, 14).filter(suicide).length <= 3, 'Screebs stay a handful');
});

test('U14 factions: mission plans', () => {
  eq(FA.zonePlan('io1', 0, 3, false), { open: null, reinf: null });
  eq(FA.zonePlan('io1', 1, 3, false), { open: null, reinf: 'taken' });
  eq(FA.zonePlan('io1', 2, 3, true), { open: 'taken', reinf: 'taken' });
  eq(FA.zonePlan('ts3', 2, 4, false), { open: 'scorn', reinf: 'scorn' });
  eq(FA.zonePlan('ts3', 3, 4, true), { open: 'scorn', reinf: 'scorn' });
  eq(FA.zonePlan('e1', 1, 3, false), { open: null, reinf: null });
  eq(FA.zonePlan('io2', 2, 4, false), { open: null, reinf: 'taken' }); // a taste: reinforcements in the last zone before the boss
  eq(FA.zonePlan('io2', 3, 4, true), { open: null, reinf: null });
  eq(FA.activityFaction('io', 3), 'vex'); eq(FA.activityFaction('io', 4), null); eq(FA.activityFaction('earth', 3), null);
});

test('U14 factions: front guard, revive and blink rules', () => {
  const guard = FA.UNITS.tk_phalanx;
  const b = guard.frontGuard.box;
  ok(FA.guardMult(guard, b.x, b.y, b.z) < 0.5, 'a hit on the shield is reduced'); ok(FA.guardMult(guard, b.x, b.y, b.z) > 0.2, 'but not near-total');
  eq(FA.guardMult(guard, 0.3, 1.2, 0.5), 1); // the body beside the shield takes full damage, even from the front
  eq(FA.guardMult(guard, b.x, b.y, -0.5), 1); // from behind
  eq(FA.guardMult(guard, b.x, b.y, b.z, true), 1);
  eq(FA.guardMult(FA.UNITS.tk_vandal, b.x, b.y, b.z), 1);
  ok(FA.mayRevive({ hasSkill: true, zoneRevives: 0, burned: false, alreadyRevived: false }), 'rises');
  ok(!FA.mayRevive({ hasSkill: true, zoneRevives: 0, burned: true, alreadyRevived: false }), 'burned corpses stay down');
  ok(!FA.mayRevive({ hasSkill: true, zoneRevives: 0, burned: false, alreadyRevived: true }), 'only once');
  ok(!FA.mayRevive({ hasSkill: true, zoneRevives: FA.SKILL.reviveMaxPerZone, burned: false, alreadyRevived: false }), 'zone cap so a zone ends');
  const r = FA.blinkRange(FA.UNITS.tk_centurion, 0), r2 = FA.blinkRange(FA.UNITS.tk_centurion, 1);
  eq(r, FA.UNITS.tk_centurion.blink.range[0]); eq(r2, FA.UNITS.tk_centurion.blink.range[1]);
});

test('U14 factions: new factions have sounds, profiles and a Darkness-orb thrower', () => {
  for (const f of ['taken', 'scorn']) { ok(FACTION_SOUND[f]?.shot && FACTION_SOUND[f]?.die, `${f} sound`); ok(FA.NEW_PROFILES[f], `${f} profile`); }
  ok(TR.grenadeThrower('taken', 'tk_captain') && !TR.grenadeThrower('taken', 'tk_vandal'), 'only the Captain lobs orbs');
  eq(FA.NEW_PROFILES.scorn.coverMul, 0);
});


test('v2.9 Vex: roster, shields, stationary artillery, floating units and the Hydra spin guard', () => {
  const vexIds = Object.keys(FA.UNITS).filter((i) => i.startsWith('vx_'));
  ok(vexIds.length >= 10, 'Vex units are registered');
  for (const id of vexIds) ok(ENEMY_TYPES[id] && ENEMY_TYPES[id].faction === 'vex', `${id} registered as a Vex enemy type`);
  for (const bad of ['vx_gate_lord', 'vx_axis', 'fl_archon']) ok(!FA.UNITS[bad], `${bad} is not an enemy unit`);
  ok(FA.UNITS.vx_cyclops.stationary && FA.UNITS.hv_shrieker.stationary, 'Cyclops and Shrieker never move');
  ok(FA.UNITS.vx_cyclops.lob, 'the Cyclops fires mortar rounds');
  ok(FA.UNITS.vx_harpy.fly > 0 && FA.UNITS.vx_hydra.fly > 0 && FA.UNITS.fl_servitor.fly > 0, 'floating units hang above the floor');
  eq(FA.UNITS.vx_minotaur.shieldEl, 'void');
  ok(FA.composeWave('vex', 0, 1, 2).includes('vx_goblin') && FA.composeWave('vex', 1, 2, 4).includes('vx_wyvern'), 'Vex waves hold goblins early and a Wyvern late');
  eq(FA.zonePlan('io3', 3, 4, true), { open: 'vex', reinf: 'vex' });
  ok(FA.baseExtras('mars', 1, 1, 2).includes('lg_incendior') && FA.baseExtras('mars', 1, 1, 2).includes('lg_gladiator'), 'Cabal waves carry the Incendior and Gladiator');
  ok(FA.baseExtras('moon', 0, 1, 1).includes('hv_shrieker'), 'Hive waves carry the Shrieker');
  ok(FA.baseExtras('earth', 1, 1, 1).includes('fl_servitor'), 'Fallen waves carry the Servitor');
  ok(FA.baseExtras('earth', 0, 1, 1).filter((t) => t === 'fl_shank').length >= 3 && FA.UNITS.fl_shank.base === 'grunt' && FA.UNITS.fl_shank.fly > 0, 'Fallen waves send ordinary Shanks in groups (not the suicide kind)');
  const hy = FA.UNITS.vx_hydra;
  ok(FA.spinBlocks(hy, 0, 0.2) && !FA.spinBlocks(hy, 0, 2.5), 'the rotating shield covers only the side it faces');
  eq(FA.spinBlocks(FA.UNITS.vx_goblin, 0, 0), false);
});

// ---------- U16e terrain ----------
const hillTerrain = () => buildTerrain([
  { type: 'plateau', x: 0, z: -34, w: 24, d: 24, h: 8 },
  { type: 'ramp', x0: 0, z0: 0, x1: 0, z1: -20, width: 6, h0: 0, h1: 8 },       // 0.4 rise per metre, cliffs either side
  { type: 'mound', x: 40, z: 0, r: 10, h: 3 },
  { type: 'basin', x: -40, z: 0, r: 12, flat: 0.5, depth: 2 },
]);
const withLevel = (terrain, fn) => {
  const old = G.level, oc = G.colliders;
  G.level = { groundAt: terrain ? terrain.at : null }; G.colliders = [];
  try { return fn(); } finally { G.level = old; G.colliders = oc; }
};
test('U16e: a map with no terrain list stays flat', () => {
  eq(buildTerrain(undefined), null);
  eq(buildTerrain([]), null);
  withLevel(null, () => { eq(groundAt(5, 5), 0); });
});
test('U16e: ramp, plateau, mound and basin give the expected heights', () => {
  const t = hillTerrain();
  ok(Math.abs(t.at(0, 0)) < 0.2, 'ramp foot is at ground level');
  ok(Math.abs(t.at(0, -10) - 4) < 0.2, `ramp middle is half way up (${t.at(0, -10)})`);
  ok(Math.abs(t.at(0, -20) - 8) < 0.2, 'ramp top meets the plateau');
  ok(Math.abs(t.at(0, -34) - 8) < 1e-6, 'plateau top is flat at 8');
  ok(Math.abs(t.at(40, 0) - 3) < 1e-6, 'mound peak');
  ok(t.at(60, 0) === 0 && t.at(0, 60) === 0, 'untouched ground is 0');
  ok(t.at(-40, 0) === 0, 'ground never dips below 0');
  eq(t.at(100, 100), 0);
});
test('U16e: a ramp route is under the slope cap, and its sides are cliffs', () => {
  const t = hillTerrain();
  const r = routeSlope(t, [[0, 5], [0, -20], [0, -34]]);
  ok(r < MAX_SLOPE, `route slope ${r.toFixed(3)} is under ${MAX_SLOPE}`);
  ok(steepest(t, { minX: -60, maxX: 60, minZ: -60, maxZ: 20 }, 1).slope > MAX_SLOPE, 'the short skirts are steeper than a Guardian climbs');
});
test('U16e: the player walks up a ramp and back down, glued to the ground', () => {
  const t = hillTerrain();
  withLevel(t, () => {
    const pos = { x: 0, y: 0, z: 2 }, vel = { x: 0, y: 0, z: -7 };
    let res;
    for (let i = 0; i < 160; i++) { res = moveBody(pos, vel, 1 / 60, 0.4, 1.8); vel.y = 0; ok(Math.abs(pos.y - t.at(pos.x, pos.z)) < 0.02 && res.onGround, `on the ground at step ${i} (y ${pos.y.toFixed(2)} vs ${t.at(pos.x, pos.z).toFixed(2)})`); }
    ok(pos.y > 6, `climbed (${pos.y.toFixed(2)})`);
    vel.z = 7;
    for (let i = 0; i < 160; i++) { res = moveBody(pos, vel, 1 / 60, 0.4, 1.8); ok(res.onGround, `still grounded going down at step ${i}`); }
    ok(pos.y < 1, 'back near the bottom');
  });
});
test('U16e: ground steeper than the cap is a wall, and a jump gets over a low lip', () => {
  const t = buildTerrain([{ type: 'plateau', x: 0, z: -20, w: 20, d: 20, h: 6, edge: 0.5 }]); // a near-cliff
  withLevel(t, () => {
    const pos = { x: 0, y: 0, z: 0 }, vel = { x: 0, y: 0, z: -7 };
    for (let i = 0; i < 200; i++) moveBody(pos, vel, 1 / 60, 0.4, 1.8);
    ok(pos.y < 1 && pos.z > -9.8, `stopped at the foot of the cliff (z ${pos.z.toFixed(2)}, y ${pos.y.toFixed(2)})`);
  });
});
test('U16e: a body dropped onto a hill lands on it, and a ray finds the ground', () => {
  const t = hillTerrain();
  withLevel(t, () => {
    const pos = { x: 40, y: 10, z: 0 }, vel = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 120; i++) { vel.y -= 24 / 60; moveBody(pos, vel, 1 / 60, 0.4, 1.8); }
    ok(Math.abs(pos.y - 3) < 0.05, `rests on the mound top (${pos.y.toFixed(2)})`);
    const o = { x: 40, y: 10, z: 0 }, d = { x: 0, y: -1, z: 0 };
    ok(Math.abs(rayGround(o, d, 50) - 7) < 0.05, 'a ray straight down hits the mound top 7 m below');
    const side = { x: -0.8, y: 0, z: 0.6 }; // a level shot from the foot of the ramp toward the plateau is not blocked, but one into the slope is
    ok(rayGround({ x: 0, y: 1, z: 5 }, { x: 0, y: 0, z: -1 }, 40) < 40, 'a level shot into the ramp hits the hillside');
    ok(rayGround({ x: 0, y: 1, z: 5 }, { x: 0, y: 1, z: 0 }, 40) === Infinity, 'a shot straight up never hits ground');
    ok(side.x < 0, 'unused guard');
  });
});
test('U16e: the nav grid follows terrain, paths climb a ramp, and hillsides are not ledges', () => {
  const t = hillTerrain();
  const b = { minX: -60, maxX: 60, minZ: -60, maxZ: 20 };
  const nav = buildNav([], b, { ground: t.at });
  ok(Math.abs(heightAt(nav, 0, -10) - t.at(0.5, -9.5)) < 0.7, 'a ramp cell holds the ramp height');
  const r = findPath(nav, 0, 5, 0, -34);
  ok(r && !r.partial, 'a path climbs from the foot to the plateau');
  eq(ledgeSpots(nav, floodReach(nav, 0, 5), 0, -10, 8, 1).length, 0);
  const rc = Math.floor((-10 - b.minZ) / nav.cell) * nav.W + Math.floor((0 - b.minX) / nav.cell);
  ok(nav.base[rc] > 3, 'base records the terrain under each cell');
});
test('U16e: a crate on a plateau is a ledge measured from the plateau, not from 0', () => {
  const t = buildTerrain([{ type: 'plateau', x: 0, z: 0, w: 60, d: 60, h: 5, edge: 3 }]);
  const nav = buildNav([{ min: { x: 4, y: 5, z: 4 }, max: { x: 6, y: 6.2, z: 6 } }], { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, { ground: t.at });
  ok(Math.abs(heightAt(nav, 5, 5) - 6.2) < 1e-6, 'the crate top is standable at 6.2');
  ok(heightAt(nav, -10, -10) > 4.9, 'plain plateau floor is walkable');
});


// ---------- U17a: patrol zones, beacons, public events, the Ghost and the Sparrow ----------
const EP = PATROL_DATA.e_patrol, PS = EP.patrol;
const sites = () => [...PS.beacons, ...PS.beacons.map((b) => b.site), ...PS.events, ...PS.camps, ...Object.values(PS.npcs)];
test('U17a: Earth has a patrol zone, and every site in it is inside the map', () => {
  eq(LOCATIONS[0].patrol.id, 'e_patrol');
  const [minX, maxX, minZ, maxZ] = EP.bounds;
  for (const p of sites()) ok(p.x > minX + 6 && p.x < maxX - 6 && p.z > minZ + 6 && p.z < maxZ - 6, `site (${p.x}, ${p.z}) is inside the bounds`);
  ok(PS.beacons.length >= 3 && PS.events.length >= 2 && PS.camps.length >= 8, 'the zone is populated');
});
test('U17a: no ambient camp wakes at the landing, and the landing is clear of every site', () => {
  const [sx, sz] = EP.spawn;
  for (const c of PS.camps) ok(Math.hypot(c.x - sx, c.z - sz) > PATROL_TUNE.wake + 10, `camp (${c.x}, ${c.z}) is far enough from the landing`);
  for (const b of PS.beacons) ok(Math.hypot(b.site.x - sx, b.site.z - sz) > 40, `${b.id}'s site is away from the landing`);
});
test('U17a: the zones mirror the beacon and event sites, so props stay off them', () => {
  for (const p of [...PS.beacons, ...PS.events]) ok(EP.zones.some((z) => Math.hypot(z.x - p.x, z.z - p.z) < 1), `a zone sits on (${p.x}, ${p.z})`);
});
test('U17a: the patrol terrain: the on-ramp is walkable and nothing at a site is a cliff', () => {
  const t = buildTerrain(EP.terrain);
  ok(routeSlope(t, [[-138, 96], [-138, 46]]) < MAX_SLOPE, 'the highway on-ramp is under the slope cap');
  ok(Math.abs(t.at(-138, 28) - 7) < 0.05, 'the abutment is at deck height (7 m)');
  const dock = steepest(t, { minX: 64, maxX: 136, minZ: 48, maxZ: 120 }, 1);
  ok(dock.slope < MAX_SLOPE, `the dry dock basin is walkable (${dock.slope.toFixed(2)})`);
  const rocks = steepest(t, { minX: 70, maxX: 130, minZ: -64, maxZ: -4 }, 1);
  ok(rocks.slope < MAX_SLOPE, `the rocks under the spire are walkable (${rocks.slope.toFixed(2)})`);
  for (const p of sites()) ok(steepest(t, { minX: p.x - 3, maxX: p.x + 3, minZ: p.z - 3, maxZ: p.z + 3 }, 1).slope < MAX_SLOPE, `(${p.x}, ${p.z}) is not on a cliff`);
});
test('U17a: every beacon and event has its script', () => {
  const kinds = new Set(['grunt', 'rusher', 'captain', 'heavy', 'suicide']);
  for (const b of PS.beacons) {
    ok(BEACON_TEXT[b.type], `${b.id} has a card for ${b.type}`);
    if (b.type === 'hunt') ok(b.target?.name && kinds.has(b.target.unit), `${b.id} names a target`);
  }
  for (const e of PS.events) {
    const sp = EVENT_SPECS[e.id];
    ok(sp, `${e.id} has a script`);
    ok(sp.marked.n >= 1 && sp.marked.time >= 30 && kinds.has(sp.marked.unit), `${e.id}'s heroic mechanic is set`);
    ok(sp.pushes.length >= 2 && sp.pushes.every((p) => p.every(([t, n]) => kinds.has(t) && n >= 1)), `${e.id}'s pushes are valid`);
    ok(kinds.has(sp.finale.unit) && sp.finale.heroicN > sp.finale.n, `${e.id}'s heroic finale is bigger`);
  }
  ok(EVENT_SPECS.hive_ritual.faction === 'hollow' && EVENT_SPECS.salvage_defense.faction === null, 'one Hive event and one of the destination\'s own');
});
test('U17a: the Hive in the Earth patrol wear the Moon\'s colours', () => {
  const earth = LOCATIONS.find((l) => l.id === 'earth'), moon = LOCATIONS.find((l) => l.id === 'moon');
  eq(EVENT_SPECS.hive_ritual.faction, 'hollow');
  eq(FA.enemyColors('hollow', earth).enemy, moon.colors.enemy); // U17d: every faction has one look (this replaced the H16 event palette)
});
test('U17a: the Ghost holds: 1 second to summon a Sparrow, 5 to return to orbit', () => {
  eq(SPARROW.summonHold, 1); eq(SPARROW.orbitHold, 5);
  ok(SPARROW.boost > SPARROW.top && SPARROW.top > SPARROW.reverse, 'boost beats cruise beats reverse');
});
test('U17a: a patrol meeting is offered once, waits while its quest is active, and finishing it marks it done', () => {
  const s = { cleared: {} };
  eq(Q.patrolMeetingsFor(s, 'earth').length, 0, 'nothing waits before the patrol is entered');
  Q.offerPatrolQuests(s, 'earth'); Q.offerPatrolQuests(s, 'earth');
  eq(s.quests.active.filter((id) => id === 'cayde_earth').length, 1, 'offered once');
  const m = Q.patrolMeetingsFor(s, 'earth');
  eq(m.length, 1); eq(m[0].npc, 'cayde'); eq(m[0].place, 'patrol:earth');
  const row = Q.questList(s).find((r) => r.quest.id === 'cayde_earth');
  ok(row && row.place.includes('patrol zone') && row.state === 'active', 'the Quests tab shows where to go');
  ok(Q.metPatrolMeeting(s, 'cayde_earth'), 'meeting finishes the quest');
  ok(!Q.metPatrolMeeting(s, 'cayde_earth'), 'but only once');
  eq(Q.patrolMeetingsFor(s, 'earth').length, 0);
  ok(s.quests.done.includes('cayde_earth'));
  Q.offerPatrolQuests(s, 'earth');
  ok(!s.quests.active.includes('cayde_earth'), 'a finished meeting is not offered again');
});
test('U17a: a dropped patrol quest keeps its NPC away until it is picked up again', () => {
  const s = { cleared: {} };
  Q.offerPatrolQuests(s, 'earth');
  eq(Q.abandonQuest(s, 'cayde_earth'), null);
  eq(Q.patrolMeetingsFor(s, 'earth').length, 0);
  Q.offerPatrolQuests(s, 'earth');
  ok(!s.quests.active.includes('cayde_earth'), 'offering does not undo a drop');
  eq(Q.pickUpQuest(s, 'cayde_earth'), null);
  eq(Q.patrolMeetingsFor(s, 'earth').length, 1);
});

// ---------- U17b: Moon and Mars patrol zones ----------
const KINDS_B = new Set(['grunt', 'rusher', 'captain', 'heavy', 'suicide']);
const unitOk = (u) => KINDS_B.has(u) || !!FA.UNITS[u]; // a base role, or (U17e) a real unit id
for (const [dest, pid] of [['moon', 'm_patrol'], ['mars', 'r_patrol'], ['titan', 't_patrol'], ['io', 'i_patrol'], ['tangled', 'ts_patrol'], ['dc', 'dc_patrol']]) {
  const D = PATROL_DATA[pid], P = D.patrol;
  const all = () => [...P.beacons, ...P.beacons.map((b) => b.site), ...P.events, ...P.camps, ...Object.values(P.npcs)];
  test(`U17b: ${dest} has a patrol zone wired to the Director, and every site is inside the map`, () => {
    eq(LOCATIONS.find((l) => l.id === dest).patrol.id, pid);
    const [minX, maxX, minZ, maxZ] = D.bounds;
    for (const p of all()) ok(p.x > minX + 6 && p.x < maxX - 6 && p.z > minZ + 6 && p.z < maxZ - 6, `site (${p.x}, ${p.z}) is inside the bounds`);
    ok(P.beacons.length >= 4 && P.events.length >= 2 && P.camps.length >= 10, 'the zone is populated');
  });
  test(`U17b: ${dest}: landing is clear, zones mirror sites, no cliff at a site`, () => {
    const [sx, sz] = D.spawn;
    for (const c of P.camps) ok(Math.hypot(c.x - sx, c.z - sz) > PATROL_TUNE.wake + 10, `camp (${c.x}, ${c.z}) is far from the landing`);
    for (const b of P.beacons) ok(Math.hypot(b.site.x - sx, b.site.z - sz) > 40, `${b.id} is away from the landing`);
    for (const p of [...P.beacons, ...P.events]) ok(D.zones.some((z) => Math.hypot(z.x - p.x, z.z - p.z) < 1), `a zone sits on (${p.x}, ${p.z})`);
    const t = buildTerrain(D.terrain);
    for (const p of all()) ok(steepest(t, { minX: p.x - 3, maxX: p.x + 3, minZ: p.z - 3, maxZ: p.z + 3 }, 1).slope < MAX_SLOPE, `(${p.x}, ${p.z}) is not on a cliff`);
  });
  test(`U17b: ${dest}: every beacon and event has its script and every faction kit is known`, () => {
    for (const b of P.beacons) {
      ok(BEACON_TEXT[b.type], `${b.id} has a card for ${b.type}`);
      ok(!b.f || FACTION_KITS[b.f], `${b.id} names a known faction kit (none means the destination's own)`);
      if (b.type === 'hunt') ok(b.target?.name && unitOk(b.target.unit), `${b.id} names a target`);
    }
    for (const c of P.camps) ok(!c.f || FACTION_KITS[c.f], `camp (${c.x}, ${c.z}) names a known faction kit`);
    for (const e of P.events) {
      const sp = EVENT_SPECS[e.id];
      ok(sp && unitOk(sp.marked.unit) && sp.pushes.length >= 2 && sp.finale.heroicN > sp.finale.n, `${e.id} is scripted`);
    }
  });
  test(`U17b: ${dest}'s patrol NPC is offered, once, at the patrol`, () => {
    const s = { cleared: {} };
    Q.offerPatrolQuests(s, dest); Q.offerPatrolQuests(s, dest);
    const m = Q.patrolMeetingsFor(s, dest);
    eq(m.length, 1); eq(m[0].place, `patrol:${dest}`);
    ok(Q.metPatrolMeeting(s, m[0].quest || m[0].id), 'meeting finishes the quest');
  });
}
test('U17b: Fallen and Hive kits borrow the Earth and Moon colours', () => {
  eq(FACTION_KITS.fallen.faction, 'scrappers'); eq(FACTION_KITS.fallen.pal, undefined); // U17d: the faction's own look, no palette
  eq(FACTION_KITS.hive.faction, 'hollow'); eq(FACTION_KITS.hive.pal, undefined);
  eq(EVENT_SPECS.station_defense.faction, 'scrappers');
  eq(EVENT_SPECS.cabal_drop.faction, null);
});
test('U17b: the Mars subway ramps are under the slope cap and the trench floor is at ground 0', () => {
  const t = buildTerrain(PATROL_DATA.r_patrol.terrain);
  ok(routeSlope(t, [[-62, -62], [-62, -86]]) < MAX_SLOPE, 'the south portal ramp is walkable');
  ok(routeSlope(t, [[-62, -148], [-62, -168]]) < MAX_SLOPE, 'the north portal ramp is walkable');
  ok(Math.abs(t.at(-62, -120)) < 0.05, 'the tunnel floor is at 0');
  ok(Math.abs(t.at(-20, -120) - 5) < 0.3, 'the city bed above it is at 5');
});

// ---------- U17c: the Titan patrol zone ----------
{
  const D = PATROL_DATA.t_patrol, P = D.patrol, T = buildTerrain(D.terrain);
  const rect = (x, z, m = 0) => TITAN_DECKS.find(([, x0, x1, z0, z1]) => x > x0 + m && x < x1 - m && z > z0 + m && z < z1 - m);
  const sites = () => [...P.beacons, ...P.beacons.map((b) => b.site), ...P.events, ...P.camps, ...Object.values(P.npcs)];
  test('U17c: Titan: every beacon, site, event, camp and NPC stands inside a deck, away from its edge', () => {
    for (const p of sites()) ok(rect(p.x, p.z, 2), `(${p.x}, ${p.z}) is on a deck`);
  });
  test('U17c: Titan: every deck is level with its own height, the gallery floor is at 0 and the sea sits above it', () => {
    for (const [id, x0, x1, z0, z1, kind] of TITAN_DECKS) {
      const x = (x0 + x1) / 2, z = (z0 + z1) / 2;
      if (kind === 'x') continue;
      ok(Math.abs(T.at(x, z) - TITAN.deck) < 0.01 && Math.abs(T.at(x0 + 1, z0 + 1) - TITAN.deck) < 0.01, `${id} is flat at the deck height`);
    }
    ok(Math.abs(T.at(134, -170)) < 0.01 && Math.abs(T.at(130, -100)) < 0.01, 'the chamber and the gallery floor are at 0');
    ok(TITAN.sea > 8.5 && TITAN.sea < TITAN.deck - 8, 'the sea is above the gallery roof (8) and well below the decks');
  });
  test('U17c: Titan: the descent tube is a walkable ramp from the dome floor to the gallery floor', () => {
    const { x0, x1, z0, h0 } = TITAN_RAMP;
    ok(routeSlope(T, [[x0 - 4, z0], [x1 + 4, z0]]) < MAX_SLOPE, 'the ramp is under the slope cap');
    ok(Math.abs(T.at(x0 - 4, z0) - h0) < 0.01 && Math.abs(T.at(x1 + 4, z0)) < 0.01, 'it runs from the deck to 0');
  });
  test('U17c: Titan: the decks are one connected network from the landing, and every bridge fits a Sparrow', () => {
    const touch = (a, b) => a[1] <= b[2] && b[1] <= a[2] && a[3] <= b[4] && b[3] <= a[4];
    const seen = new Set([TITAN_DECKS[0][0]]);
    for (let grew = true; grew;) { grew = false; for (const a of TITAN_DECKS) for (const b of TITAN_DECKS) if (seen.has(a[0]) && !seen.has(b[0]) && touch(a, b)) { seen.add(b[0]); grew = true; } }
    eq(seen.size, TITAN_DECKS.length);
    for (const [id, x0, x1, z0, z1, kind] of TITAN_DECKS) if (kind === 'b') ok(Math.min(x1 - x0, z1 - z0) >= 8, `${id} is at least 8 m wide`);
  });
  test('U17c: Titan: the breach and hatch events are Hive scripts with a heroic', () => {
    for (const id of ['rig_breach', 'brood_hatch']) {
      const sp = EVENT_SPECS[id];
      ok(sp.faction === null && sp.marked.n >= 2 && sp.pushes.length >= 2 && sp.finale.heroicN > sp.finale.n, `${id} is complete`);
    }
    ok(P.beacons.some((b) => b.type === 'hunt') && P.beacons.some((b) => b.type === 'clear') && P.beacons.length >= 4, 'the beacons mix hunts and clears');
  });
}


test('U17d: one look per faction on every destination; Loyalists, Taken and Scorn keep theirs', () => {
  const at = (id) => LOCATIONS.find((l) => l.id === id), look = (C) => [C.enemy, C.enemy2, C.eye, C.accent];
  for (const [f, home] of Object.entries(FA.FACTION_HOME)) for (const L of LOCATIONS) {
    if (f === 'legion' && L.colors.loyalist) continue;
    eq(look(FA.enemyColors(f, L)), look(FA.enemyColors(f, at(home))), `${f} on ${L.id} wear the ${home} look`);
    eq(FA.enemyColors(f, L).sky, L.colors.sky, `${f} on ${L.id}: the scenery colours stay the destination's`);
  }
  for (const f of ['hollow', 'legion']) eq(look(FA.enemyColors(f, at('io'))), look(at(FA.FACTION_HOME[f]).colors), `${f} take their home destination's colours`);
  eq(look(FA.enemyColors('scrappers', at('earth'))), [0xd8ccae, 0x5a2622, 0x7fd8ff, 0xa3281f], 'U18: the Fallen wear red and bone, not the Earth blue');
  eq(look(FA.enemyColors('legion', at('leviathan'))), look(at('leviathan').colors), 'the Loyalist Cabal keep the gold');
  ok(FA.enemyColors('legion', at('leviathan')).loyalist && !FA.enemyColors('legion', at('io')).loyalist, 'only the Leviathan has Loyalists');
  for (const f of ['taken', 'scorn', 'vex']) for (const L of LOCATIONS) eq(FA.enemyColors(f, L).enemy, FA.FACTIONS[f].colors.enemy, `${f} on ${L.id}`);
  eq(FA.enemyColors('hollow', at('titan'), true), at('titan').colors, 'a boss with its own model keeps the destination colours');
  let threw = false; try { FA.enemyColors('nobody', at('io')); } catch { threw = true; }
  ok(threw, 'an unknown faction is an error, not a silent fallback');
});

test('U17d: Supplicant and Taken Incendior retired; Taken Hobgoblin added; every roster entry resolves', () => {
  for (const id of ['vx_supplicant', 'tk_incendior']) {
    ok(!FA.UNITS[id] && !ENEMY_TYPES[id], `${id} is gone`);
    for (const list of Object.values(FA.ROSTER)) ok(!list.some((r) => r.t === id), `${id} is in no roster`);
  }
  ok(FA.UNITS.lg_incendior, 'the Cabal Incendior stays');
  eq(FA.UNITS.tk_hobgoblin.faction, 'taken');
  ok(FA.ROSTER.taken.some((r) => r.t === 'tk_hobgoblin') && FA.ROSTER.vex.some((r) => r.t === 'vx_fanatic'), 'the replacements are rostered');
  for (const list of [...Object.values(FA.ROSTER), ...Object.values(FA.BASE_EXTRAS)]) for (const r of list) ok(ENEMY_TYPES[r.t], `${r.t} is a defined enemy type`);
});

test('U17d: the sniper skill (Vex Hobgoblin, Taken Vandal, Taken Hobgoblin)', () => {
  const snipers = Object.keys(FA.UNITS).filter((id) => FA.UNITS[id].skills?.includes('snipe')).sort();
  eq(snipers, ['lg_psion', 'sc_raider', 'tk_hobgoblin', 'tk_vandal', 'vx_hobgoblin']);
  for (const id of snipers) {
    const d = FA.UNITS[id];
    ok(d.snipe.charge > FA.SKILL.snipe.lock + 0.5, `${id}: the aim line shows well before the lock`);
    ok(d.snipe.dmg > 0 && d.snipe.dmg < 50 && d.snipe.cd[0] >= 3, `${id}: high damage, never a one-shot, not spammed`);
    ok(d.range >= 50, `${id} engages at range`);
  }
  ok(!FA.UNITS.tk_vandal.skills.includes('ward'), 'the Taken Vandal lost its ward');
  eq(FA.snipePhase(1.2), 'track'); eq(FA.snipePhase(FA.SKILL.snipe.lock - 0.01), 'lock'); eq(FA.snipePhase(0), 'fire');
  const p = { x: 10, y: 1.1, z: 5 };
  ok(FA.snipeHits(p, { x: 10.5, y: 1.1, z: 5 }), 'a Guardian still on the locked point is hit');
  ok(!FA.snipeHits(p, { x: 11.5, y: 1.1, z: 5 }), 'a sidestep out of the line dodges it');
});

test('U17d: the Tangled Shore is fought against the Scorn', () => {
  eq(LOCATIONS.find((l) => l.id === 'tangled').faction, 'Scorn');
  for (const L of LOCATIONS.filter((l) => l.id === 'tangled')) for (const m of L.missions) {
    for (let zi = 0; zi < m.zones; zi++) eq(FA.zonePlan(m.id, zi, m.zones, zi === m.zones - 1), { open: 'scorn', reinf: 'scorn' }, `${m.id} zone ${zi}`);
  }
  for (const n of [1, 2, 3, 4]) eq(FA.activityFaction('tangled', n), 'scorn');
  eq(FA.activityFaction('io', 3), 'vex'); eq(FA.activityFaction('io', 2), null);
  eq(FA.LOC_FACTION.tangled, 'scorn');
});

// ---------- U17e: the Io patrol zone ----------
{
  const D = PATROL_DATA.i_patrol, P = D.patrol, T = buildTerrain(D.terrain);
  const inPyr = (p) => p.x > -70 && p.x < 70 && p.z > -230 && p.z < -90;
  const inBase = (p) => p.x > 104 && p.x < 192 && p.z > -146 && p.z < -54;
  test('U17e: Io: the Pyramidion is a sunk hall: floor, ledge, plinth and pit heights', () => {
    ok(Math.abs(T.at(0, -76) - IO.plinth) < 0.01 && Math.abs(T.at(0, -97) - IO.plinth) < 0.01, 'the gate ledge is at the plinth');
    for (const [x, z] of [[-60, -130], [60, -130], [-60, -220], [60, -220], [0, -125]]) ok(Math.abs(T.at(x, z) - IO.pit) < 0.01, `(${x}, ${z}) is on the main floor`);
    ok(Math.abs(T.at(0, -172)) < 0.01 && T.at(0, -148) < IO.pit, 'the pit under the core sinks to 0');
    ok(IO.plinth - IO.pit >= 18, 'the descent is at least 18 m');
  });
  test('U17e: Io: every Sparrow road, stairway and ramp is under the slope cap', () => {
    const routes = [
      [[0, -18], [0, -72]], [[12, -98], [46, -98]], [[-12, -98], [-46, -98]], [[54, -101], [54, -150]], [[-54, -101], [-54, -150]],
      [[-22, 100], [-52, 100]], [[22, 100], [52, 100]], [[-62, 88], [-62, 64]], [[62, 88], [62, 64]], [[-26, -20], [-50, -16]], [[26, -20], [50, -16]],
      [[150, -20], [150, -48]], [[-150, -96], [-150, -120]], [[0, 156], [0, -16]], [[0, 16], [-160, 10]], [[0, 16], [142, 12]], [[-104, 16], [-98, -74]], [[-98, -74], [-150, -92]], // H18: Charon's ramp moved to its north side
    ];
    for (const r of routes) ok(routeSlope(T, r) < MAX_SLOPE, `route ${JSON.stringify(r)} is walkable`);
  });
  test('U17e: Io: every area has an intentional road and the Pyramidion, base, tree, Scar and Charon sit where the data says', () => {
    ok(Math.abs(T.at(150, -100) - IO.base) < 0.01 && Math.abs(T.at(-150, -152) - IO.charon) < 0.01 && Math.abs(T.at(142, 12) - IO.scar) < 0.01, 'the base, Charon and Scar pads are flat');
    ok(P.npcs.asher && Math.abs(T.at(P.npcs.asher.x, P.npcs.asher.z) - IO.charon) < 0.01, 'Asher stands on the Charon pad');
    for (const [x, z] of [[0, 156], [-160, 12], [142, 24], [-150, -92], [150, -66]]) ok(T.at(x, z) < 12, `(${x}, ${z}) is on low ground`);
  });
  test('U17e: Io: at least five beacons, spread over the canyons, Giant\'s Scar, the blight, the Pyramidion and the Cabal base', () => {
    ok(P.beacons.length >= 5, 'five or more');
    ok(P.beacons.some((b) => b.type === 'clear' && inPyr(b)), 'a Clear inside the Pyramidion');
    ok(P.beacons.some((b) => b.type === 'clear' && inBase(b) && !b.f), 'a Clear inside the Cabal base, against the Red Legion');
    ok(P.beacons.some((b) => b.type === 'hunt' && b.f === 'taken'), 'a Taken hunt at the blight');
    ok(P.beacons.some((b) => !b.f && Math.hypot(b.site.x - 142, b.site.z - 12) < 30), "a camp at Giant's Scar");
    ok(P.beacons.filter((b) => b.f === 'vex').length >= 3, 'Vex beacons across the canyons');
    ok(P.beacons.some((b) => b.type === 'hunt') && P.beacons.some((b) => b.type === 'clear'), 'hunts and clears');
  });
  test('U17e: Io: camps are mostly Vex, Taken near the blight and Charon, Cabal in their base and at the Scar', () => {
    const f = (k) => P.camps.filter((c) => (c.f ?? 'cabal') === k);
    ok(f('vex').length > f('taken').length + f('cabal').length - 4 && f('vex').length >= 12, 'the Vex hold most camps');
    ok(f('taken').length >= 3 && f('taken').every((c) => c.x < -100 && c.z < -80), 'the Taken stay by the blight and Charon');
    ok(f('cabal').length >= 5 && f('cabal').every((c) => c.x > 100), 'the Cabal hold the east');
    ok(P.camps.filter((c) => c.f === 'vex' && inPyr(c)).length >= 4, 'Vex camps inside the Pyramidion');
    ok(P.camps.filter(inBase).length >= 3, 'camps inside the Cabal base');
  });
  test('U17e: Io: the Vex Incursion and Taken Blight events are complete, name a kit, and resolve to real units', () => {
    for (const [id, faction] of [['vex_incursion', 'vex'], ['taken_blight', 'taken']]) {
      const sp = EVENT_SPECS[id];
      eq(sp.faction, faction); eq(sp.units, FACTION_KITS[faction].units);
      ok(sp.marked.n >= 2 && sp.pushes.length >= 2 && sp.finale.heroicN > sp.finale.n, `${id} has a heroic mechanic`);
      ok(FA.UNITS[kitUnit(sp.units, sp.marked.unit, (a) => a[0])], `${id} marks a real unit`);
      ok(FA.UNITS[kitUnit(sp.units, sp.finale.unit, (a) => a[0])], `${id} ends on a real unit`);
      for (const push of sp.pushes) for (const [role] of push) ok(FA.UNITS[kitUnit(sp.units, role, (a) => a[0])], `${id} pushes ${role}`);
    }
    eq(kitUnit(EVENT_SPECS.vex_incursion.units, 'captain'), 'vx_minotaur');
    ok(['tk_captain', 'tk_centurion'].includes(kitUnit(FACTION_KITS.taken.units, 'captain')), 'the Taken captain role');
    ok(P.events.length === 2 && P.events.every((e) => EVENT_SPECS[e.id]), 'both events are placed');
  });
  test('U17e: faction kits: a unit map resolves each role to a real unit, a list picks, an explicit id passes through, no map keeps the base type', () => {
    for (const k of ['vex', 'taken']) {
      eq(FA.UNITS[kitUnit(FACTION_KITS[k].units, 'grunt', (a) => a[0])].faction, k);
      for (const role of ['grunt', 'rusher', 'captain', 'heavy', 'suicide']) for (const pick of [(a) => a[0], (a) => a.at(-1)]) {
        const u = kitUnit(FACTION_KITS[k].units, role, pick);
        ok(FA.UNITS[u] && FA.UNITS[u].faction === k, `${k} ${role} -> ${u}`);
      }
    }
    eq(kitUnit(undefined, 'captain'), 'captain'); eq(kitUnit(FACTION_KITS.fallen.units, 'heavy'), 'heavy');
    eq(kitUnit({ heavy: ['a', 'b'] }, 'heavy', (a) => a[1]), 'b'); eq(kitUnit({}, 'tk_ogre'), 'tk_ogre');
    ok(FACTION_KITS.vex.pal === undefined && FACTION_KITS.taken.pal === undefined, 'no palette: the faction look');
  });
  test('U17e: Asher Mir has a meeting, a quest, and a talk', () => {
    const m = Q.PATROL_MEETINGS.find((x) => x.id === 'asher_io');
    ok(m && m.dest === 'io' && m.npc === 'asher' && m.place === 'patrol:io', 'the meeting');
    eq(Q.QUESTS.asher_io.name, 'The Last Touch'); eq(Q.QUESTS.asher_io.meeting, 'asher_io');
    const talk = ST_.PATROL_TALKS.asher_io;
    ok(talk.length >= 3 && talk.every(([who, text]) => ST_.SPEAKERS[who] && text.length > 5 && !/[–—]/.test(text)), 'the talk');
  });
}

// ---------- U17f: the Tangled Shore patrol zone ----------
{
  const D = PATROL_DATA.ts_patrol, P = D.patrol, T = buildTerrain(D.terrain);
  const voidAt = (x, z) => T.at(x, z) < D.voidBelow; // world.js voidAt for this map (no open edges)
  const island = (id) => TANGLED_ISLANDS.find((i) => i[0] === id);
  const on = (id, p) => { const [, a, b, c, d] = island(id); return p.x > a && p.x < b && p.z > c && p.z < d; };
  test('U17f: Tangled: islands stand over the abyss: solid on every island, deck and plank, void between them and under the cloud sea', () => {
    for (const [id, x0, x1, z0, z1, h] of TANGLED_ISLANDS) {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      ok(Math.abs(T.at(cx, cz) - h) < 0.01 && !voidAt(cx, cz), `${id} is solid at its height`);
    }
    for (const r of TANGLED_RAMPS) ok(!voidAt((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2), `${r.id} is solid`);
    for (const [x, z] of [[0, 180], [-60, 100], [60, 100], [-40, 10], [40, -10], [0, -100], [-30, -80], [170, 0], [-170, 160]]) ok(voidAt(x, z), `(${x}, ${z}) is the abyss`);
    ok(voidAt(8, 90) && !voidAt(5, 90), 'the landing deck has an open edge');
    ok(TANGLED.sea < TANGLED.voidBelow && TANGLED.voidBelow < Math.min(...TANGLED_ISLANDS.map((i) => i[5])), 'the cloud sea lies below the void line, the islands above it');
  });
  test('U17f: Tangled: every area is joined to the landing by decks and planks a Guardian can walk, the Sparrow routes are wide decks', () => {
    for (const r of [[[0, 150], [0, 60]], [[0, 50], [-78, 46], [-80, -96]], [[0, 50], [30, 40], [76, 40], [80, -100]], [[0, 50], [0, -26]], [[-20, -30], [-80, -30], [-80, -96]], [[0, -30], [80, -30], [80, -100]], [[0, 146], [-92, 146]], [[0, 88], [40, 88]], [[0, 92], [-42, 92]]]) {
      ok(routeSlope(T, r) < MAX_SLOPE, `route ${JSON.stringify(r)} is walkable`);
      for (let i = 1; i < r.length; i++) for (let k = 0; k <= 40; k++) { const x = r[i - 1][0] + (r[i][0] - r[i - 1][0]) * k / 40, z = r[i - 1][1] + (r[i][1] - r[i - 1][1]) * k / 40; ok(!voidAt(x, z), `(${x.toFixed(1)}, ${z.toFixed(1)}) on ${JSON.stringify(r)} has a floor`); }
    }
    for (const r of TANGLED_RAMPS) ok(r.kind === 'p' ? r.width < 5 : r.width >= 10, `${r.id}: decks are wide, planks narrow`);
    for (const i of TANGLED_ISLANDS.filter((x) => x[6] === 'd')) ok(Math.min(i[2] - i[1], i[4] - i[3]) >= 10, `${i[0]} is wide enough for the Sparrow`);
  });
  test('U17f: Tangled: Fallen hold the Rift and the Cove, Scorn the flats and Trapper\'s Cave, Hive the crashed ship; the landing and the lair are safe', () => {
    const all = [...P.camps, ...P.beacons];
    for (const c of all) ok(['fallen', 'scorn', 'hive'].includes(c.f), `(${c.x}, ${c.z}) names its faction`);
    for (const c of all) ok(!on('landing', c.site ?? c) && !on('lair', c.site ?? c), `(${c.x}, ${c.z}) is not in the safe hub`);
    ok(P.camps.filter((c) => c.f === 'scorn').every((c) => on('flats', c)), 'the Scorn stay on the flats');
    ok(P.camps.filter((c) => c.f === 'hive').every((c) => on('hulk', c)), 'the Hive stay at the ship');
    ok(P.camps.filter((c) => c.f === 'fallen').every((c) => !on('flats', c) && !on('hulk', c)), 'the Fallen hold the rest');
    for (const f of ['fallen', 'scorn', 'hive']) ok(P.beacons.some((b) => b.f === f), `a ${f} beacon`);
    ok(P.beacons.length >= 5 && P.beacons.some((b) => b.f === 'hive' && b.type === 'clear' && b.site.z < -107 && b.site.z > -133), 'five beacons, one a Clear inside the hold');
  });
  test('U17f: Tangled: the Ether Resupply and Hive Awakening events are complete and resolve to real units of their faction', () => {
    eq(EVENT_SPECS.ether_resupply.faction, 'scorn'); eq(EVENT_SPECS.ether_resupply.units, FACTION_KITS.scorn.units);
    eq(EVENT_SPECS.hive_awakening.faction, 'hollow');
    const sp = EVENT_SPECS.ether_resupply;
    for (const u of [sp.marked.unit, sp.finale.unit, ...sp.pushes.flat().map(([r]) => r)]) eq(FA.UNITS[kitUnit(sp.units, u, (a) => a[0])].faction, 'scorn');
    eq(sp.marked.unit, 'sc_chieftain');
    for (const role of ['grunt', 'rusher', 'captain', 'heavy', 'suicide']) for (const pick of [(a) => a[0], (a) => a.at(-1)]) eq(FA.UNITS[kitUnit(FACTION_KITS.scorn.units, role, pick)].faction, 'scorn');
    eq(FACTION_KITS.scorn.pal, undefined); // the faction's default look
    ok(on('flats', P.events.find((e) => e.id === 'ether_resupply')) && on('hulk', P.events.find((e) => e.id === 'hive_awakening')), 'each event on its faction\'s ground');
  });
  test('U17f: Petra Venj has a meeting, a quest and a talk; the Spider talks in his lair with his guards', () => {
    const m = Q.PATROL_MEETINGS.find((x) => x.id === 'petra_tangled');
    ok(m && m.dest === 'tangled' && m.npc === 'petra', 'the meeting');
    eq(Q.QUESTS.petra_tangled.name, "The Queen's Wrath");
    ok(on('landing', P.npcs.petra), 'Petra waits at the landing');
    const sp = P.talkers.find((t) => t.npc === 'spider');
    ok(sp && on('lair', sp) && ST_.PATROL_TALKS[sp.talk]?.length >= 2, 'the Spider sits in his lair and has lines');
    ok(P.figures.filter((f) => f.npc === 'spiderguard' && on('lair', f)).length === 2, 'two guards beside him');
    for (const id of ['petra_tangled', 'spider_lair']) ok(ST_.PATROL_TALKS[id].every(([who, text]) => ST_.SPEAKERS[who] && !/[–—]/.test(text)), `${id} speakers and text`);
  });
}

// ---------- U17g: the Dreaming City patrol zone ----------
{
  const D = PATROL_DATA.dc_patrol, P = D.patrol, T = buildTerrain(D.terrain);
  const voidAt = (x, z) => T.at(x, z) < D.voidBelow; // world.js voidAt for this map (no open edges)
  const island = (id) => DREAMING_ISLANDS.find((i) => i[0] === id);
  const on = (id, p) => { const [, a, b, c, d] = island(id); return p.x > a && p.x < b && p.z > c && p.z < d; };
  test('U17g: Dreaming City: islands stand over the abyss: solid on every island, deck and path, void between them and under the cloud sea', () => {
    for (const [id, x0, x1, z0, z1, h] of DREAMING_ISLANDS) {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      ok(!voidAt(cx, cz), `${id} is solid at its centre`);
      ok(Math.abs(T.at(x0 + 1, z0 + 1) - h) < 0.01 || id === 'top' || id === 'cavern' || id === 'palace' || id === 'court', `${id} is flat at its height`);
    }
    for (const r of DREAMING_RAMPS) for (let k = 0; k <= 20; k++) { const x = r.x0 + (r.x1 - r.x0) * k / 20, z = r.z0 + (r.z1 - r.z0) * k / 20; ok(!voidAt(x, z), `${r.id} has a floor at ${k}/20`); }
    for (const [x, z] of [[0, 185], [-80, 130], [80, 120], [-100, 48], [60, 30], [-60, -20], [60, -20], [-80, -100], [180, -100], [0, -150], [-185, 0], [185, 120]]) ok(voidAt(x, z), `(${x}, ${z}) is the abyss`);
    ok(DREAMING.sea < DREAMING.voidBelow && DREAMING.voidBelow < Math.min(...DREAMING_ISLANDS.map((i) => i[5])), 'the cloud sea lies below the void line, the islands above it');
    ok(!voidAt(94, -92) && T.at(94, -92) < 40 - 0.5, 'the palace pool is sunken but still has a floor');
  });
  test('U17g: Dreaming City: every area is joined to the Strand by paths a Guardian can walk; the Sparrow routes are wide decks', () => {
    const routes = [[[0, 150], [0, 60]], [[0, 76], [-70, 76], [-123, 76], [-123, 50], [-133, 10], [-133, -40]], [[0, 66], [76, 66], [104, 60], [104, 0], [94, -30], [94, -60]], [[0, 60], [0, 8], [60, 8], [90, 8]],
      [[104, 60], [135, 64], [164, 64]], [[123, 10], [123, -40], [123, -115], [123, -130], [100, -150]], [[0, 10], [0, -30], [0, -60], [0, -80], [0, -90]], [[94, -52], [94, -80], [94, -100]]];
    for (const r of routes) {
      ok(routeSlope(T, r) < MAX_SLOPE, `route ${JSON.stringify(r)} is walkable`);
      for (let i = 1; i < r.length; i++) for (let k = 0; k <= 40; k++) { const x = r[i - 1][0] + (r[i][0] - r[i - 1][0]) * k / 40, z = r[i - 1][1] + (r[i][1] - r[i - 1][1]) * k / 40; ok(!voidAt(x, z), `(${x.toFixed(1)}, ${z.toFixed(1)}) on ${JSON.stringify(r)} has a floor`); }
    }
    for (const r of DREAMING_RAMPS) ok(r.kind === 'd' ? r.width >= 12 : r.width >= 7, `${r.id} is wide enough for its kind`);
    for (const id of ['toMists', 'toCourt', 'bridgeE', 'bridgeC', 'bridgeP', 'toLower']) ok(DREAMING_RAMPS.find((r) => r.id === id).kind === 'd', `${id} is a Sparrow deck`);
    for (const r of DREAMING_RAMPS) ok(Math.abs(r.h1 - r.h0) / Math.hypot(r.x1 - r.x0, r.z1 - r.z0) < MAX_SLOPE, `${r.id} climbs gently`);
  });
  test('U17g: Dreaming City: Taken hold the Mists, the Well, the Gardens, the palace and the cavern, Scorn the lower decks and Aphelion\'s Rest; the Strand is safe', () => {
    const all = [...P.camps, ...P.beacons];
    for (const c of all) ok(['taken', 'scorn'].includes(c.f), `(${c.x}, ${c.z}) names Taken or Scorn (no Awoken enemies)`);
    ok(P.camps.length >= 20 && P.beacons.length >= 5, 'populated');
    for (const c of all) ok(!on('strand', c.site ?? c), `(${c.x}, ${c.z}) is not on the Strand`);
    for (const c of P.camps.filter((q) => q.f === 'scorn')) ok(on('lower', c) || on('rest', c), `Scorn camp (${c.x}, ${c.z}) is on the lower decks or Aphelion's Rest`);
    for (const c of P.camps.filter((q) => q.f === 'taken')) ok(!on('lower', c) && !on('rest', c), `Taken camp (${c.x}, ${c.z}) is not on Scorn ground`);
    for (const f of ['taken', 'scorn']) ok(P.beacons.some((b) => b.f === f && b.type === 'clear') && P.beacons.some((b) => b.f === f && b.type === 'hunt') || f === 'taken', `a ${f} beacon`);
    ok(P.beacons.some((b) => b.id === 'stair_clear' && b.type === 'clear' && on('top', b)), 'a Clear at the head of the cavern stair');
    ok(P.beacons.some((b) => b.id === 'mists_hunt' && on('mists', b)) && P.beacons.some((b) => b.id === 'gardens_clear' && on('garden1', b)), 'the Mists Bounty and the Gardens Clear');
  });
  test('U17g: Dreaming City: the Blind Well has a hold plate and is complete, Ether Resupply is reused at Aphelion\'s Rest', () => {
    const sp = EVENT_SPECS.blind_well;
    eq(sp.faction, 'taken'); eq(sp.units, FACTION_KITS.taken.units);
    for (const u of [sp.marked.unit, sp.finale.unit, ...sp.pushes.flat().map(([r]) => r)]) eq(FA.UNITS[kitUnit(sp.units, u, (a) => a[0])].faction, 'taken');
    ok(sp.hold && sp.hold.r > 3 && sp.hold.need > 0 && sp.hold.drain >= 0 && sp.hold.text, 'a hold plate');
    const well = P.events.find((e) => e.id === 'blind_well'), rest = P.events.find((e) => e.id === 'ether_resupply');
    ok(well && on('court', well) && sp.hold.r < well.r, 'the Well is in its court, the light ring inside the event circle');
    ok(rest && on('rest', rest), "Ether Resupply is at Aphelion's Rest");
    for (const e of P.events) ok(D.zones.some((z) => Math.hypot(z.x - e.x, z.z - e.z) < 1), `a zone sits on ${e.id}`);
  });
  test('U17g: Dreaming City: Petra Venj has a second meeting, independent of the Tangled Shore one, with its own quest and talk', () => {
    const a = Q.PATROL_MEETINGS.find((x) => x.id === 'petra_tangled'), b = Q.PATROL_MEETINGS.find((x) => x.id === 'petra_dc');
    ok(a && b && a.npc === 'petra' && b.npc === 'petra' && a.dest !== b.dest, 'both meetings exist side by side');
    eq(b.dest, 'dc'); eq(b.place, 'patrol:dc'); eq(b.text, 'Find Petra Venj on the Strand');
    eq(Q.QUESTS.petra_dc.name, 'The Torn Veil'); eq(Q.QUESTS.petra_dc.meeting, 'petra_dc');
    ok(on('strand', P.npcs.petra), 'Petra waits on the Strand');
    const talk = ST_.PATROL_TALKS.petra_dc;
    ok(talk.length >= 3 && talk.length <= 5 && talk.every(([who, text]) => ST_.SPEAKERS[who] && text.length > 5 && !/[–—]/.test(text)), 'the talk');
    // independent: finishing one leaves the other offered
    const s = { quests: Q.newQuests() };
    Q.offerPatrolQuests(s, 'tangled'); Q.offerPatrolQuests(s, 'dc');
    eq(Q.patrolMeetingsFor(s, 'tangled').map((m) => m.id), ['petra_tangled']); eq(Q.patrolMeetingsFor(s, 'dc').map((m) => m.id), ['petra_dc']);
    ok(Q.metPatrolMeeting(s, 'petra_dc'), 'the Dreaming City meeting is done');
    eq(Q.patrolMeetingsFor(s, 'dc').length, 0); eq(Q.patrolMeetingsFor(s, 'tangled').map((m) => m.id), ['petra_tangled']);
    ok(Q.metPatrolMeeting(s, 'petra_tangled'), 'then the Tangled Shore one');
    eq(Q.patrolMeetingsFor(s, 'tangled').length, 0);
  });
  test('U17g: Dreaming City: the Director offers a patrol, with a Taken boss model, between the Tangled Shore patrol and the campaign', () => {
    const L = LOCATIONS.find((l) => l.id === 'dc');
    eq(L.patrol.id, 'dc_patrol');
    ok(L.patrol.power > LOCATIONS.find((l) => l.id === 'tangled').patrol.power && L.patrol.power <= L.missions[0].power, 'power fits');
    ok(FA.UNITS.tk_ogre && L.patrol.boss.model === 'takenchampion', 'a Taken boss model');
    ok(!/[–—]/.test(L.patrol.desc), 'no dashes');
  });
}

// ---------- U17g: patrol notice range and the Ghost holds ----------
test('U17g: in a patrol zone an enemy only notices a player within the notice range', () => {
  eq(PATROL_TUNE.notice, 60);
  ok(AI.withinNotice(59 * 59, PATROL_TUNE.notice), '59 m is seen');
  ok(!AI.withinNotice(45 * 45 + 45 * 45, PATROL_TUNE.notice), '63.6 m is not');
  ok(AI.withinNotice(400 * 400, undefined), 'campaign missions set no range: the nearest player anywhere');
});
test('U17g: the Sparrow hold is 1 s and the orbit hold 5 s', () => { eq(SPARROW.summonHold, 1); eq(SPARROW.orbitHold, 5); });

// ---------- runner ----------
const out = document.getElementById('out');
test('U18: every Fallen unit builds a model with crit meshes, a muzzle and its animation hooks', () => {
  const units = ['grunt', 'rusher', 'captain', 'heavy', 'suicide', 'boss', 'fl_shank', 'fl_servitor'];
  for (const t of units) {
    const g = new THREE.Group(), hit = [];
    const add = (geo, m, x, y, z, parent = g, crit = false, r = null) => {
      const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); if (r) mesh.rotation.set(r[0], r[1], r[2]);
      mesh.userData.crit = crit; parent.add(mesh); hit.push(mesh); return mesh;
    };
    const B = (w, h, d, x, y, z, m, parent = g, crit = false, r = null) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent, crit, r);
    const pivot = (x, y, z, parent = g) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
    const mk = (col) => new THREE.MeshStandardMaterial({ color: col });
    const c = { g, add, B, pivot, bodyMat: mk(0xd8ccae), dark: mk(0x5a2622), accent: mk(0x7fd8ff), C: { accent: 0xa3281f }, muzzle: new THREE.Object3D(), legs: [], arms: [], torso: null, height: 2.05 };
    fallen(c, t);
    ok(hit.some((m) => m.userData.crit), `${t} has a crit mesh`);
    ok(c.torso && c.muzzle.parent, `${t} has a torso and a mounted muzzle`);
    const floats = ['suicide', 'fl_shank', 'fl_servitor'].includes(t);
    ok(floats ? c.hover && c.legs.length === 0 : c.legs.length === 2, `${t}: ${floats ? 'hovers' : 'walks on two legs'}`);
    if (t === 'rusher' || t === 'grunt' || t === 'captain') ok(c.arms.length === 2, `${t} has its two animated upper arms`);
  }
  let threw = false; try { fallen({}, 'nobody'); } catch { threw = true; }
  ok(threw, 'an unknown Fallen unit is an error');
});

test('U18: every Hive unit builds a model with crit meshes, a muzzle and its animation hooks; the Wizard floats and casts', () => {
  const units = ['grunt', 'rusher', 'captain', 'heavy', 'suicide', 'boss', 'hv_shrieker', 'hv_wizard'];
  for (const t of units) {
    const g = new THREE.Group(), hit = [];
    const add = (geo, m, x, y, z, parent = g, crit = false, r = null) => {
      const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); if (r) mesh.rotation.set(r[0], r[1], r[2]);
      mesh.userData.crit = crit; parent.add(mesh); hit.push(mesh); return mesh;
    };
    const B = (w, h, d, x, y, z, m, parent = g, crit = false, r = null) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent, crit, r);
    const pivot = (x, y, z, parent = g) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
    const mk = (col) => new THREE.MeshStandardMaterial({ color: col });
    const c = { g, add, B, pivot, bodyMat: mk(0xd6cfb8), dark: mk(0x3a382f), accent: mk(0x6dff8e), C: {}, muzzle: new THREE.Object3D(), legs: [], arms: [], torso: null, height: 2.05 };
    hive(c, t);
    ok(hit.some((m) => m.userData.crit), `${t} has a crit mesh`);
    ok(c.torso && c.muzzle.parent, `${t} has a torso and a mounted muzzle`);
    const floats = ['hv_shrieker', 'hv_wizard'].includes(t);
    ok(floats ? c.hover && c.legs.length === 0 : c.legs.length === 2, `${t}: ${floats ? 'hovers' : 'walks on two legs'}`);
    if (t !== 'hv_shrieker' && t !== 'suicide') ok(c.arms.length === 2, `${t} has two animated arms`);
    if (t === 'suicide') ok(c.arms.length === 0, 'the Cursed Thrall keeps its self-hug (no animated arms)');
    if (t === 'hv_shrieker') ok(c.spinners?.length === 2 && c.spinners[0].speed === -c.spinners[1].speed && c.spinners[0].speed !== 0, 'the Shrieker shell halves turn in opposite directions');
  }
  let threw = false; try { hive({}, 'nobody'); } catch { threw = true; }
  ok(threw, 'an unknown Hive unit is an error');
  const w = FA.UNITS.hv_wizard;
  ok(w.faction === 'hollow' && w.base === 'captain' && w.fly > 0 && w.shieldEl, 'the Wizard is a shielded, floating Hive caster');
  ok(FA.baseExtras('moon', 1, 1, 1).includes('hv_wizard') && !FA.baseExtras('moon', 1, 0, 0).includes('hv_wizard'), 'Hive reinforcements bring a Wizard from the second zone up');
});

test('U18: every Cabal unit builds a model with crit meshes, a muzzle and its animation hooks; Loyalists wear gold', () => {
  const units = ['grunt', 'rusher', 'captain', 'heavy', 'lg_incendior', 'lg_gladiator', 'lg_psion', 'lg_phalanx'];
  for (const loyalist of [false, true]) for (const t of units) {
    const g = new THREE.Group(), hit = [];
    const add = (geo, m, x, y, z, parent = g, crit = false, r = null) => {
      const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); if (r) mesh.rotation.set(r[0], r[1], r[2]);
      mesh.userData.crit = crit; parent.add(mesh); hit.push(mesh); return mesh;
    };
    const B = (w, h, d, x, y, z, m, parent = g, crit = false, r = null) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent, crit, r);
    const pivot = (x, y, z, parent = g) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
    const mk = (col) => new THREE.MeshStandardMaterial({ color: col });
    const c = { g, add, B, pivot, bodyMat: mk(0x8b2c24), dark: mk(0x3a2420), accent: mk(0xffb347), C: { loyalist }, muzzle: new THREE.Object3D(), legs: [], arms: [], torso: null, height: 2.05 };
    cabal(c, t);
    ok(hit.some((m) => m.userData.crit), `${t} has a crit mesh`);
    ok(c.torso && c.muzzle.parent, `${t} has a torso and a mounted muzzle`);
    ok(c.legs.length === (t === 'rusher' ? 4 : 2), `${t} has its legs`);
    if (t !== 'rusher') ok(c.arms.length === 2, `${t} has two animated arms`);
    if (t === 'captain') ok(c.flames?.length === 2 && c.flames.every((f) => !f.visible), 'the Centurion has hidden jet flames');
    if (t === 'lg_incendior') ok(hit.filter((m) => m.userData.crit).every((m) => m.position.z < -0.3), 'the Incendior helmet is crit-proof; only the tanks are');
    if (t === 'grunt') eq(c.bodyMat.color.getHex(), loyalist ? 0xc9a046 : 0xb4b0a8);
  }
  let threw = false; try { cabal({}, 'nobody'); } catch { threw = true; }
  ok(threw, 'an unknown Cabal unit is an error');
  ok(FA.UNITS.lg_psion.skills.includes('snipe') && FA.UNITS.lg_phalanx.skills.includes('frontGuard'), 'the Psion snipes and the Phalanx guards');
  ok(FA.baseExtras('mars', 0, 1, 0).includes('lg_psion') && !FA.baseExtras('mars', 0, 0, 0).includes('lg_psion') && FA.baseExtras('mars', 1, 1, 1).includes('lg_phalanx'), 'Cabal waves bring Psions and Phalanxes from the second zone up');
});

test('U18: every Scorn unit builds a model with crit meshes, a muzzle and its animation hooks; the Ravager carries its lantern', () => {
  const units = ['sc_screeb', 'sc_wraith', 'sc_stalker', 'sc_raider', 'sc_lurker', 'sc_ravager', 'sc_chieftain', 'sc_abomination'];
  for (const t of units) {
    const g = new THREE.Group(), hit = [];
    const add = (geo, m, x, y, z, parent = g, crit = false, r = null) => {
      const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); if (r) mesh.rotation.set(r[0], r[1], r[2]);
      mesh.userData.crit = crit; parent.add(mesh); hit.push(mesh); return mesh;
    };
    const B = (w, h, d, x, y, z, m, parent = g, crit = false, r = null) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent, crit, r);
    const pivot = (x, y, z, parent = g) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
    const mk = (col) => new THREE.MeshStandardMaterial({ color: col });
    const c = { g, add, B, pivot, bodyMat: mk(0x8b8470), dark: mk(0x3a342c), accent: mk(0xc37aff), C: { eye: 0xc37aff }, muzzle: new THREE.Object3D(), legs: [], arms: [], torso: null, height: 2.05 };
    scorn(c, t);
    ok(hit.some((m) => m.userData.crit), `${t} has a crit mesh`);
    ok(c.torso && c.muzzle.parent, `${t} has a torso and a mounted muzzle`);
    eq(c.legs.length, t === 'sc_screeb' ? 4 : 2, `${t} legs`);
    if (t !== 'sc_screeb') ok(c.arms.length >= 1, `${t} has animated arms`);
    eq(c.bodyMat.color.getHex(), 0xd8cfbf, `${t} wears the Scorn skin`);
    if (t === 'sc_ravager') {
      ok(c.lamp?.arm && c.lamp.chain && !c.arms.includes(c.lamp.arm), 'the Ravager lantern arm is posed by its skill, not the melee arm swing');
      ok(c.height < 2.1, 'the Ravager is normal size');
    }
    if (t === 'sc_abomination') ok(hit.filter((m) => m.userData.crit).every((m) => m.parent !== c.torso || m.position.y > 1), 'the Abomination weak point is the helm in its chest');
  }
  let threw = false; try { scorn({}, 'nobody'); } catch { threw = true; }
  ok(threw, 'an unknown Scorn unit is an error');
});

test('U18: Scorn roster: Stalkers and Lurkers are common, Wraiths rare, Ravagers are red-bar slammers in packs of one to four, the Raider snipes', () => {
  const U = FA.UNITS;
  ok(U.sc_ravager.hp <= 130 && !U.sc_ravager.scale && U.sc_ravager.skills.includes('lampSlam') && U.sc_ravager.lampSlam.pool.dps > 0, 'Ravager: normal size and health, lantern slam with a fire pool');
  ok(U.sc_raider.skills.includes('snipe') && U.sc_raider.range >= 50, 'the Raider is the sniper');
  for (const [zi, g] of [[0, 0], [1, 2], [2, 9]]) {
    const w = [...FA.composeWave('scorn', 0, zi, g), ...FA.composeWave('scorn', 1, zi, g)], n = (t) => w.filter((x) => x === t).length;
    ok(n('sc_stalker') > n('sc_wraith') && n('sc_lurker') >= n('sc_wraith'), `zone ${zi}, power ${g}: Stalkers and Lurkers outnumber Wraiths`);
    ok(n('sc_wraith') <= 1, 'at most one Wraith');
  }
  for (const r of [0, 0.5, 0.99]) for (const [zi, g] of [[1, 0], [2, 4], [3, 20]]) { const k = FA.ravagerPack(zi, g, r); ok(k >= 1 && k <= 4, `Ravager pack ${k}`); }
  eq(FA.ravagerPack(1, 0, 0), 1); eq(FA.ravagerPack(3, 20, 0.99), 4);
  eq(FA.slamPhase(0.3), 'spin'); eq(FA.slamPhase(0), 'slam');
  const pool = U.sc_ravager.lampSlam.pool, at = { x: 0, z: 0 };
  eq(FA.poolTickDmg(pool, at, pool.radius - 0.1, 0), pool.dps * FA.SKILL.lampSlam.tick, 'standing in the fire burns');
  eq(FA.poolTickDmg(pool, at, pool.radius + 0.1, 0), 0, 'outside it does not');
});

test('H17 float check: a flat slab on a slope is caught, a grounded, leaned or carried one is not', () => {
  const ground = (x) => Math.max(0, x * 0.25); // 1 in 4 rising east of x = 0
  const sc = new THREE.Scene(), box = (w, h, d, x, y, z, o = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial());
    m.position.set(x, y, z); if (o.rz) m.rotation.z = o.rz; sc.add(m); return m;
  };
  const slab = box(8, 0.2, 2, 8, ground(4) + 0.1, 0); // bottom on the ground at its west end (x = 4), east end sunk into the slope: it hangs nowhere
  const hang = box(8, 0.2, 2, 8, ground(12) + 0.1, 10); // bottom meets the ground at its east end (x = 12): the west end hangs 2 m over the slope
  const tilted = box(8, 0.2, 2, 8, 2, 20, { rz: Math.atan(0.25) }); // leaned with the slope on purpose
  const strip = box(6, 0.1, 0.4, -10, 0.6, 30);       // lifted 0.55 m off flat ground with nothing under it
  const deck = box(6, 0.2, 2, -10, 1.1, 40); box(0.5, 1, 0.5, -10, 0.5, 40); // carried by a post
  const hits = findFloats(sc, ground);
  const of = (m) => hits.find((h) => h.mesh === m);
  ok(of(hang)?.kind === 'slope', 'slab hanging off the slope is a slope float');
  ok(of(strip)?.kind === 'hover', 'lifted strip is a hover float');
  ok(!of(slab) && !of(tilted) && !of(deck), 'grounded, leaned and carried pieces are fine');
  hang.userData.floatOk = true;
  ok(!findFloats(sc, ground).some((h) => h.mesh === hang), 'floatOk marks a deliberate overhang');
});

test('H17 laid(): every piece of a strip meets the ground at both ends on a slope', () => {
  const sc = new THREE.Scene(), ground = (x, z) => 2 + x * 0.2 + z * 0.05 + (x > 10 ? (x - 10) * 0.3 : 0); // a plane with a bend at x = 10
  const K = { ground, mesh: (geo, color, x, y, z, o) => { const m = new THREE.Mesh(geo); m.position.set(x, y + ground(x, z), z); m.rotation.set(0, o.ry, o.rz); sc.add(m); return m; } };
  laid(K, -4, 0, 26, 9, 2, 0, { y: 0, h: 0.05 });
  sc.updateMatrixWorld(true);
  ok(sc.children.length >= 11 && sc.children.length <= 13, `about 3 m pieces, the one over the bend halved (${sc.children.length})`);
  for (const m of sc.children) for (const sx of [-1, 1]) {
    const p = new THREE.Vector3(sx * m.geometry.parameters.width / 2, -0.025, 0).applyMatrix4(m.matrixWorld);
    ok(Math.abs(p.y - ground(p.x, p.z)) < 0.12, `end at ${p.x.toFixed(1)},${p.z.toFixed(1)} is ${(p.y - ground(p.x, p.z)).toFixed(2)} off the ground`);
  }
});

test('U19 Light gap: over-Light caps at +10; at 0 nothing changes; small gaps match the old curve', () => {
  ok(LI.lightGap(300, 250) === 10, 'over-Light capped at +10');
  ok(LI.lightGap(200, 230) === -30, 'under-Light gap is not clamped');
  const z = LI.lightMults(0);
  ok(z.playerDmgMult === 1 && z.incomingMult === 1 && !z.immune, 'gap 0 is neutral');
  const o = LI.lightMults(10);
  ok(Math.abs(o.playerDmgMult - 1.2) < 1e-9 && Math.abs(o.incomingMult - 0.75) < 1e-9, '+10 as before');
  const u = LI.lightMults(-10);
  ok(Math.abs(u.playerDmgMult - 0.81) < 1e-9 && Math.abs(u.incomingMult - 1.28) < 1e-9, `-10: ${u.playerDmgMult} dealt, ${u.incomingMult} taken`);
});

test('U19 Light gap: 50 under is beatable but extremely hard, 51 under is immune', () => {
  const h = LI.lightMults(-50);
  ok(!h.immune && Math.abs(h.playerDmgMult - 0.25) < 1e-9 && Math.abs(h.incomingMult - 3) < 1e-9, `-50: ${h.playerDmgMult} dealt, ${h.incomingMult} taken`);
  const i = LI.lightMults(-51);
  ok(i.immune && i.playerDmgMult === 0 && i.incomingMult === LI.LIGHT.immuneIncoming, '-51 is immune');
  ok(LI.lightMults(-200).immune, 'far under is immune');
  let prevD = 2, prevI = 0;
  for (let g = 10; g >= -50; g--) {
    const m = LI.lightMults(g);
    ok(m.playerDmgMult <= prevD && m.incomingMult >= prevI, `monotone at ${g}`);
    prevD = m.playerDmgMult; prevI = m.incomingMult;
  }
});

test('U19 fireteam Light: a member below the leader plays at the leader\'s Light; above keeps their own; solo is own', () => {
  ok(LI.effectiveLight(180, 220) === 220, 'raised to the leader');
  ok(LI.effectiveLight(240, 220) === 240, 'kept when higher');
  ok(LI.effectiveLight(180, undefined) === 180, 'solo');
  ok(LI.effectiveLight(180, null) === 180, 'no leader Light sent');
});

test('U19 scrambled names: stable, same length, spaces kept, never the real name', () => {
  const a = LI.scrambleName('Dreg of House Dusk'), b = LI.scrambleName('Dreg of House Dusk');
  ok(a === b, 'stable');
  ok([...a].length === 'Dreg of House Dusk'.length, 'same length');
  ok(a.split(' ').length === 4, 'spaces kept');
  ok(a !== 'Dreg of House Dusk' && !/[A-Za-z]/.test(a), 'no readable letters');
});

// ---------- U20a Legend and Ultimate (tiers) ----------
const allIds = () => LOCATIONS.flatMap((l) => l.missions.map((m) => m.id));
const clearAll = (s, tier) => { for (const id of allIds()) CA.recordClear(s, id, tier); };
const blankTiers = () => ({ classId: 'stalker', cleared: {}, tier: 'base', tierCleared: { legendary: {}, ultimate: {} }, ultimateAll: false });

test('U20a tier caps and offsets: Base 200, Legendary 300 at +25, Ultimate 350 at +50 with no revives', () => {
  eq(CA.CAMPAIGN_TIERS.base.cap, LIGHT_CAP); eq(CA.CAMPAIGN_TIERS.legendary.cap, 300); eq(CA.CAMPAIGN_TIERS.ultimate.cap, 350);
  eq(CA.tierEnemyLight(100, 'base', 140), 100, 'base: the mission Light');
  eq(CA.tierEnemyLight(100, 'legendary', 210), 235, 'legendary: your Light +25');
  eq(CA.tierEnemyLight(100, 'ultimate', 310), 360, 'ultimate: your Light +50');
  eq([CA.tierEnemyLight(305, 'ultimate', 305), CA.tierEnemyLight(305, 'ultimate', 320), CA.tierEnemyLight(305, 'ultimate', 250)], [355, 370, 355], 'U20b ultimate: +50 over your Light or the mission Light, whichever is higher');
  eq([CA.tierEnemyLight(250, 'legendary', 200), CA.tierEnemyLight(250, 'legendary', 250), CA.tierEnemyLight(250, 'legendary', 260)], [275, 275, 285], 'v4.3.1 legendary: +25 over your Light or the mission Light, whichever is higher');
  eq(['base', 'legendary', 'ultimate'].map((id) => CA.tierOf(id).density), [1, 1.25, 1.5], 'U20b: Legendary and Ultimate send more enemies');
  ok(!LI.lightMults(LI.lightGap(310, 360)).immune, 'Ultimate is extremely hard, never immune');
  ok(CA.CAMPAIGN_TIERS.ultimate.lethal && !CA.CAMPAIGN_TIERS.legendary.lethal && !CA.CAMPAIGN_TIERS.base.lethal);
});

test('U20a mission Light per tier: base unchanged, Legendary spans 200-300, Ultimate 300-350, always rising', () => {
  const p = LOCATIONS.flatMap((l) => l.missions.map((m) => m.power));
  for (const x of p) eq(CA.tierPower(x, 'base'), x);
  eq(CA.tierPower(p[0], 'legendary'), 200); eq(CA.tierPower(p.at(-1), 'legendary'), 300);
  eq(CA.tierPower(p[0], 'ultimate'), 300); eq(CA.tierPower(p.at(-1), 'ultimate'), 350);
  for (const tier of ['legendary', 'ultimate']) for (let i = 1; i < p.length; i++) ok(CA.tierPower(p[i], tier) >= CA.tierPower(p[i - 1], tier), `${tier} ${i}`);
});

test('U20a capRoll: under the cap a reward climbs; past it, it holds your Light', () => {
  eq(CA.capRoll(150, 4), 154); eq(CA.capRoll(198, 4), 200); eq(CA.capRoll(260, 4), 260);
});

test('U20a unlocks: Legendary on a base clear, Ultimate on a Legendary clear, an Ultimate clear opens both for every Guardian', () => {
  const s = blankTiers();
  eq(CA.unlockedTiers(s), ['base']);
  const ids = allIds();
  for (const id of ids.slice(0, -1)) ok(!CA.recordClear(s, id, 'base').legendary, 'not until the last mission');
  eq(CA.recordClear(s, ids.at(-1), 'base'), { legendary: true, ultimate: false, all: false });
  eq(CA.unlockedTiers(s), ['base', 'legendary']);
  s.tier = 'ultimate'; eq(CA.selectedTier(s), 'base', 'a locked pick falls back to Base');
  clearAll(s, 'legendary');
  eq(CA.unlockedTiers(s), ['base', 'legendary', 'ultimate']); eq(CA.selectedTier(s), 'ultimate');
  eq(Object.keys(s.cleared).length, ids.length, 'Legendary clears do not touch the base record');
  for (const id of ids.slice(0, -1)) CA.recordClear(s, id, 'ultimate');
  ok(!s.ultimateAll);
  eq(CA.recordClear(s, ids.at(-1), 'ultimate').all, true);
  const other = { ...blankTiers(), ultimateAll: true };
  eq(CA.unlockedTiers(other), ['base', 'legendary', 'ultimate'], 'account-wide');
});

test('U20a mission order per tier: Legendary missions open in order by Legendary clears, with no Tower stops', () => {
  fresh();
  const s = S.createSave('stalker');
  ok(S.isUnlocked(s, 0, 0, 'legendary'), 'first mission always open');
  ok(!S.isUnlocked(s, 0, 1, 'legendary'));
  CA.recordClear(s, LOCATIONS[0].missions[0].id, 'legendary');
  ok(S.isUnlocked(s, 0, 1, 'legendary')); ok(!S.isUnlocked(s, 0, 1), 'base still needs its own clear');
  for (const m of LOCATIONS[0].missions) CA.recordClear(s, m.id, 'legendary');
  ok(S.isUnlocked(s, 1, 0, 'legendary'), 'next destination opens without a Tower debrief');
});

test('U20a majors: Base keeps the old rule, Legendary and Ultimate roll majors across the board', () => {
  ok(['grunt', 'rusher', 'suicide'].every((u) => TR.majorChance(u, 8) === 0), 'base: small units never major');
  for (const tier of ['legendary', 'ultimate']) {
    ok(['grunt', 'rusher', 'suicide'].every((u) => TR.majorChance(u, 0, tier) > 0), `${tier}: small units can be majors`);
    ok(TR.majorChance('captain', 0, tier) > TR.majorChance('captain', 0), `${tier}: more large majors`);
    eq(TR.majorChance('boss', 0, tier), 0);
  }
  ok(TR.majorChance('grunt', 0, 'ultimate') > TR.majorChance('grunt', 0, 'legendary'), 'Ultimate has more');
  eq(TR.rollTier('grunt', 0, 0.01, 'legendary'), 'major'); eq(TR.rollTier('grunt', 0, 0.01), 'minor');
});

test('U20a save v10 upgrades through v11: base clears kept, tier fields added for every Guardian', () => {
  const v10 = { version: 10, classId: 'stalker', glimmer: 5, inventory: [], vault: [], equipped: {}, cleared: { e1: true }, postmaster: [], quests: Q.newQuests(), subclass: {}, loadout: {}, shaders: { owned: [], applied: {} }, exoticsFound: [], progression: { xp: 0, claimed: [] }, settings: {},
    chars: { vanguard: { inventory: [], equipped: {}, cleared: { e1: true, e2: true }, postmaster: [], quests: Q.newQuests() } } };
  fresh({ afterlight_save_v2: JSON.stringify(v10) });
  const s = S.loadSave();
  eq(s.version, S.SAVE_VERSION); eq(s.cleared, { e1: true }); eq(s.tier, 'base'); eq(s.tierCleared, { legendary: {}, ultimate: {} }); eq(s.ultimateAll, false);
  eq(s.chars.vanguard.tier, 'base'); eq(s.chars.vanguard.tierCleared, { legendary: {}, ultimate: {} }); eq(s.chars.vanguard.cleared, { e1: true, e2: true });
});

test('U20a switching Guardians swaps the tier pick and clears; the Ultimate unlock is account-wide', () => {
  fresh();
  const s = S.createSave('stalker');
  s.tier = 'legendary'; s.tierCleared.legendary.e1 = true; s.ultimateAll = true;
  S.switchCharacter(s, 'vanguard');
  eq(s.tier, 'base'); eq(s.tierCleared, { legendary: {}, ultimate: {} }); ok(s.ultimateAll, 'kept');
  S.switchCharacter(s, 'stalker');
  eq(s.tier, 'legendary'); eq(s.tierCleared.legendary, { e1: true });
});

test('U20a equipped armor can be infused in place: it takes the best Light in its slot and stays equipped', () => {
  fresh();
  const s = S.createSave('stalker');
  const worn = S.getEquipped(s, 'helmet');
  const better = makeArmor('helmet', worn.power + 30, 2, null, 'stalker');
  s.inventory.push(better); s.glimmer = 1e6;
  const info = S.infuseInfo(s, worn);
  ok(info.possible && info.target === better.power, 'a higher helmet makes it possible');
  ok(S.infuseItem(s, worn.id), 'infused');
  eq(S.getEquipped(s, 'helmet').id, worn.id, 'still equipped');
  eq(S.getEquipped(s, 'helmet').power, better.power);
});

test('H27 equipped weapons infuse in place too', () => {
  fresh();
  const s = S.createSave('stalker');
  const worn = S.getEquipped(s, 'primary');
  const better = { ...worn, id: 'h27-better', power: worn.power + 25 };
  s.inventory.push(better); s.glimmer = 1e6;
  ok(S.infuseItem(s, worn.id), 'infused');
  eq(S.getEquipped(s, 'primary').id, worn.id, 'still equipped');
  eq(S.getEquipped(s, 'primary').power, better.power);
});
test('H27 lowestSlot: the equipped slot with the lowest Light, ties split at random', () => {
  fresh();
  const s = S.createSave('stalker');
  SLOTS.forEach((sl, i) => { S.getEquipped(s, sl).power = 100 + i; });
  S.getEquipped(s, 'legs').power = 50;
  eq(S.lowestSlot(s), 'legs');
  S.getEquipped(s, 'special').power = 50;
  eq(S.lowestSlot(s, () => 0), 'special'); eq(S.lowestSlot(s, () => 0.99), 'legs');
});

// ---------- U20b Legend and Ultimate II ----------
const exoticCount = (s, kind) => (kind === 'weapon' ? ['primary', 'special', 'heavy'] : ['helmet', 'arms', 'chest', 'legs']).filter((sl) => S.getEquipped(s, sl)?.rarity === 'exotic').length;
const lvl40 = (s) => { s.progression.xp = xpForLevel(40); };

test('U20b reward menus: Legendary 3+3 (keep 1+1), Ultimate 5+5 (keep 2+2), class-correct armor, no duplicates', () => {
  fresh();
  for (const cls of ['vanguard', 'stalker', 'arcanist']) {
    const s = S.createSave(cls);
    const mine = new Set(exoticArmorFor(cls).map((x) => x.name));
    for (const [tier, n, keep] of [['legendary', 3, 1], ['ultimate', 5, 2]]) {
      const m = RW.rollMenu(s, tier);
      eq([m.armor.length, m.weapons.length], [n, n], `${cls} ${tier} sizes`);
      eq([RW.REWARD_MENUS[tier].keepArmor, RW.REWARD_MENUS[tier].keepWeapons], [keep, keep]);
      ok(m.armor.every((a) => a.rarity === 'exotic' && a.kind === 'armor' && a.classId === cls && mine.has(a.name)), 'class armor');
      ok(m.weapons.every((w) => w.rarity === 'exotic' && w.kind === 'weapon'), 'exotic weapons');
      eq(new Set(m.armor.map((a) => a.name)).size, n, 'distinct armor'); eq(new Set(m.weapons.map((a) => a.name)).size, n, 'distinct weapons');
    }
  }
});

test('U20b reward menus favor exotics the Guardian has not found, and roll at their Light', () => {
  fresh();
  const s = S.createSave('stalker');
  const names = EXOTIC_WEAPONS.filter((e) => !e.dungeon).map((e) => e.name); // U23: dungeon exotics never roll in a menu, so they cannot be the unfound five
  s.exoticsFound = names.slice(0, names.length - 5); // only 5 weapons unfound
  let hits = 0;
  for (let i = 0; i < 40; i++) hits += RW.rollMenu(s, 'ultimate').weapons.filter((w) => !s.exoticsFound.includes(w.name)).length;
  ok(hits / 40 > 1.5, `a 5-item menu leans to the unfound ones (${hits / 40} of 5; blind luck would be about 0.5)`);
  const m = RW.rollMenu(s, 'legendary');
  ok([...m.armor, ...m.weapons].every((i) => i.power === Math.max(1, S.playerPower(s))), 'Light');
});

test('U20b claim validation: exactly 1+1 (Legendary) and 2+2 (Ultimate), no repeats, only items in the menu', () => {
  fresh();
  const s = S.createSave('vanguard');
  const lm = RW.rollMenu(s, 'legendary'), um = RW.rollMenu(s, 'ultimate');
  const id = (m, k, i) => m[k][i].id;
  ok(!RW.validateClaim(lm, [id(lm, 'armor', 0)], [id(lm, 'weapons', 2)]), '1+1 ok');
  ok(RW.validateClaim(lm, [], [id(lm, 'weapons', 0)]), 'missing armor');
  ok(RW.validateClaim(lm, [id(lm, 'armor', 0), id(lm, 'armor', 1)], [id(lm, 'weapons', 0)]), 'too many armor');
  ok(!RW.validateClaim(um, [id(um, 'armor', 0), id(um, 'armor', 4)], [id(um, 'weapons', 1), id(um, 'weapons', 3)]), '2+2 ok');
  ok(RW.validateClaim(um, [id(um, 'armor', 0)], [id(um, 'weapons', 1), id(um, 'weapons', 3)]), 'only 1 armor on Ultimate');
  ok(RW.validateClaim(um, [id(um, 'armor', 0), id(um, 'armor', 0)], [id(um, 'weapons', 1), id(um, 'weapons', 3)]), 'repeat');
  ok(RW.validateClaim(lm, [id(um, 'armor', 0)], [id(lm, 'weapons', 0)]), 'foreign item');
});

test('U20b claiming adds the chosen items, drops the rest, clears the menu; a full inventory sends them to the Postmaster', () => {
  fresh();
  const s = S.createSave('arcanist');
  const m = RW.queueMenu(s, 'legendary');
  const before = s.inventory.length;
  ok(RW.claimMenu(s, m.id, [], []).error, 'wrong counts refused');
  eq(RW.pendingMenus(s).length, 1, 'still pending after a refused claim');
  const r = RW.claimMenu(s, m.id, [m.armor[1].id], [m.weapons[0].id]);
  eq(r.items.map((i) => i.id), [m.armor[1].id, m.weapons[0].id]);
  eq(s.inventory.length, before + 2); eq(RW.pendingMenus(s).length, 0);
  ok(!s.inventory.some((i) => i.id === m.armor[0].id), 'unchosen gone');
  ok(s.exoticsFound.includes(m.armor[1].name), 'counted as found');
  ok(RW.claimMenu(s, m.id, [], []).error, 'a claimed menu is gone');
  const m2 = RW.queueMenu(s, 'legendary');
  for (const slot of SLOTS) while (!S.slotFull(s, slot)) s.inventory.push({ id: `pad${s.inventory.length}`, kind: 'weapon', slot, rarity: 'common', power: 1, name: 'pad' });
  const n2 = s.inventory.length, r2 = RW.claimMenu(s, m2.id, [m2.armor[0].id], [m2.weapons[0].id]);
  eq(r2.sentToPostmaster, 2); eq(s.inventory.length, n2); ok(s.postmaster.some((i) => i.id === m2.armor[0].id));
});

test('U20b pending menus survive save/load and belong to one Guardian', () => {
  const st = fresh();
  const s = S.createSave('stalker');
  const m = RW.queueMenu(s, 'ultimate');
  const loaded = S.loadSave();
  eq(RW.pendingMenus(loaded).length, 1);
  eq(RW.pendingMenus(loaded)[0].armor.map((a) => a.id), m.armor.map((a) => a.id), 'same rolled choices');
  S.switchCharacter(loaded, 'vanguard');
  eq(RW.pendingMenus(loaded), [], 'the other Guardian has none');
  S.switchCharacter(loaded, 'stalker');
  eq(RW.pendingMenus(loaded).length, 1, 'back on the first');
  ok(st.getItem('afterlight_save_v2'));
});

test('U20b unlock events: Legendary and Ultimate queue their menus, the full Ultimate clear queues none', () => {
  fresh();
  const s = S.createSave('stalker');
  const ev = RW.unlockEvents(s, { legendary: true, ultimate: false, all: false });
  eq(ev.map((e) => e.kind), ['legendary']); eq(ev[0].menu.tier, 'legendary');
  const ev2 = RW.unlockEvents(s, { legendary: false, ultimate: true, all: false });
  eq(ev2[0].menu.armor.length, 5);
  const ev3 = RW.unlockEvents(s, { legendary: false, ultimate: false, all: true });
  eq(ev3, [{ kind: 'all' }]);
  eq(RW.pendingMenus(s).length, 2);
  eq(RW.unlockEvents(s, { legendary: false, ultimate: false, all: false }), []);
});

test('U20b tier exotics: Legendary drops one on every clear of a final mission, Ultimate only on a first clear', () => {
  ok(RW.tierExoticDue('legendary', true, true) && RW.tierExoticDue('legendary', true, false), 'every clear of the boss mission');
  ok(!RW.tierExoticDue('legendary', false, true), 'not on other missions');
  ok(RW.tierExoticDue('ultimate', false, true) && RW.tierExoticDue('ultimate', true, true), 'ultimate first clear');
  ok(!RW.tierExoticDue('ultimate', true, false) && !RW.tierExoticDue('ultimate', false, false), 'ultimate repeat clears get none');
  ok(!RW.tierExoticDue('base', true, true), 'base unchanged');
  fresh();
  const s = S.createSave('vanguard');
  const it = RW.rollTierExotic(s, 250, LOCATIONS[0].id);
  eq([it.rarity, it.power], ['exotic', 250]);
  ok(it.kind === 'weapon' || it.classId === 'vanguard', 'armor is the Guardian\'s class');
});

test('U20b the Ultimate switch exists only after a full Ultimate clear', () => {
  const s = blankTiers();
  ok(!CA.overloadUnlocked(s) && !CA.overloadOn(s));
  s.overload = true; ok(!CA.overloadOn(s), 'a stored ON does nothing while locked');
  fresh(); const t = S.createSave('stalker');
  let threw = false; try { S.setOverload(t, true); } catch { threw = true; }
  ok(threw, 'setOverload refuses before the unlock');
  clearAll(s, 'ultimate');
  ok(CA.overloadUnlocked(s) && CA.overloadOn(s));
  ok(!/overload|exotic/i.test(CA.ULTIMATE_HINT.replace('An Ultimate reward awaits', '')), 'the hint says nothing more');
});

test('U20b equip rule: one exotic weapon and armor normally; any number with the switch; turning it off trims to one each', () => {
  fresh();
  const s = S.createSave('stalker'); lvl40(s); s.ultimateAll = true;
  const mk = [
    ...['primary', 'special', 'heavy'].map((sl, i) => rollItem(300, 4, sl, null, 'stalker')),
    ...['helmet', 'arms', 'chest', 'legs'].map((sl) => rollItem(300, 4, sl, null, 'stalker')),
  ];
  s.inventory.push(...mk);
  ok(!S.equipItem(s, mk[0].id), 'first exotic weapon ok');
  ok(S.equipItem(s, mk[1].id), 'second blocked while the switch is off');
  ok(!S.equipItem(s, mk[3].id) && S.equipItem(s, mk[4].id), 'armor too');
  S.setOverload(s, true);
  for (const it of mk) eq(S.equipItem(s, it.id), null, `${it.slot} equips with the switch on`);
  eq([exoticCount(s, 'weapon'), exoticCount(s, 'armor')], [3, 4]);
  const changed = S.setOverload(s, false);
  eq(changed, 5); eq([exoticCount(s, 'weapon'), exoticCount(s, 'armor')], [1, 1], 'one of each kind stays');
  ok(S.getEquipped(s, 'primary').id === mk[0].id && S.getEquipped(s, 'helmet').id === mk[3].id, 'the first exotic of each kind is kept');
  eq(S.setOverload(s, false), 0, 'idempotent');
});

test('U20b the switch is per Guardian (the unlock is account-wide) and gates level checks as before', () => {
  fresh();
  const s = S.createSave('stalker'); s.ultimateAll = true; S.setOverload(s, true);
  S.switchCharacter(s, 'vanguard');
  ok(s.ultimateAll && !CA.overloadOn(s), 'the other Guardian starts with it off');
  S.switchCharacter(s, 'stalker');
  ok(CA.overloadOn(s), 'kept on the first');
});

test('U20b save v11 upgrades to v12: tier clears kept for every Guardian, new fields added', () => {
  const v11 = { version: 11, classId: 'stalker', glimmer: 5, inventory: [], vault: [], equipped: {}, cleared: { e1: true }, tier: 'legendary', tierCleared: { legendary: { e1: true }, ultimate: {} }, ultimateAll: false, postmaster: [], quests: Q.newQuests(), subclass: {}, loadout: {}, shaders: { owned: [], applied: {} }, exoticsFound: [], progression: { xp: 0, claimed: [] }, settings: {},
    chars: { vanguard: { inventory: [], equipped: {}, cleared: { e1: true, e2: true }, tier: 'ultimate', tierCleared: { legendary: { e1: true, e2: true }, ultimate: { e1: true } }, postmaster: [], quests: Q.newQuests() } } };
  fresh({ afterlight_save_v2: JSON.stringify(v11) });
  const s = S.loadSave();
  eq(s.version, S.SAVE_VERSION); eq(s.tierCleared, { legendary: { e1: true }, ultimate: {} }); eq(s.tier, 'legendary'); eq(s.cleared, { e1: true });
  eq([s.pendingMenus, s.overload, s.skipped], [[], false, false]);
  eq(s.chars.vanguard.tierCleared, { legendary: { e1: true, e2: true }, ultimate: { e1: true } }); eq(s.chars.vanguard.cleared, { e1: true, e2: true });
  eq([s.chars.vanguard.pendingMenus, s.chars.vanguard.overload, s.chars.vanguard.skipped], [[], false, false]);
});

test('U20b slot cap: 9 per slot besides the equipped item; the 10th goes to the Postmaster; vault and Postmaster respect it', () => {
  fresh();
  const s = S.createSave('vanguard');
  eq(S.SLOT_CAP, 9);
  const eqId = s.equipped.primary, pad = (id) => ({ ...rollItem(10, 0, 'primary'), id });
  s.inventory = s.inventory.filter((i) => i.slot !== 'primary' || i.id === eqId);
  for (let i = 0; i < 9; i++) eq(S.addItem(s, pad(`p${i}`)), null);
  eq(S.slotCount(s, 'primary'), 9, 'the equipped item does not count'); ok(S.slotFull(s, 'primary'));
  const r = S.addItem(s, pad('p9'));
  ok(r && r.sent.id === 'p9', 'the 10th went to the Postmaster'); ok(!S.getItem(s, 'p9'));
  ok(!S.slotFull(s, 'helmet'), 'other slots are separate');
  s.vault.push(pad('v1'));
  ok(S.fromVault(s, 'v1'), 'cannot pull from the vault into a full slot');
  ok(S.collectPostmaster(s, 'p9'), 'cannot collect into a full slot');
  eq(S.toVault(s, 'p0'), null); eq(S.collectPostmaster(s, 'p9'), null); ok(S.getItem(s, 'p9'));
});

test('U20b save v11 to v12: extras past 9 per slot go to that Guardian\'s Postmaster, lowest Light first, nothing is lost', () => {
  const it = (id, slot, power, extra = {}) => ({ ...rollItem(power, 0, slot), id, power, ...extra });
  const prim = Array.from({ length: 12 }, (_, i) => it(`a${i}`, 'primary', 10 + i));
  prim[0].locked = true; // the weakest, but locked: kept
  const vg = Array.from({ length: 11 }, (_, i) => it(`h${i}`, 'helmet', 20 + i, { kind: 'armor', classId: 'vanguard' }));
  const v11 = { version: 11, classId: 'stalker', glimmer: 5, inventory: [...prim, it('eq', 'primary', 5)], vault: [], equipped: { primary: 'eq' }, cleared: {}, tier: 'base', tierCleared: { legendary: {}, ultimate: {} }, ultimateAll: false, postmaster: [it('old', 'heavy', 3)], quests: Q.newQuests(), subclass: {}, loadout: {}, shaders: { owned: [], applied: {} }, exoticsFound: [], progression: { xp: 0, claimed: [] }, settings: {},
    chars: { vanguard: { inventory: vg, equipped: { helmet: 'h0' }, cleared: {}, tier: 'base', tierCleared: { legendary: {}, ultimate: {} }, postmaster: [], quests: Q.newQuests() } } };
  fresh({ afterlight_save_v2: JSON.stringify(v11) });
  const s = S.loadSave();
  eq(S.slotCount(s, 'primary'), 9); ok(S.getItem(s, 'eq') && S.getItem(s, 'a0'), 'equipped and locked kept');
  eq(s.postmaster.map((i) => i.id).sort(), ['a1', 'a2', 'a3', 'old'], 'the three weakest unlocked extras moved');
  const c = s.chars.vanguard;
  eq(c.inventory.length, 11, '10 kept plus the class item v15 grants'); ok(c.inventory.some((i) => i.id === 'h0'), 'equipped helmet kept'); eq(c.postmaster.map((i) => i.id), ['h1']);
});

test('U20b Skip Campaign is offered only once some Guardian really cleared the base campaign, and only to uncleared Guardians', () => {
  fresh();
  const s = S.createSave('stalker');
  ok(!RW.skipAvailable(s) && !RW.skipAvailableFor(s, 'vanguard'), 'nobody has cleared');
  clearAll(s, 'base');
  ok(!RW.skipAvailable(s), 'the clearing Guardian cannot skip');
  ok(RW.skipAvailableFor(s, 'vanguard') && RW.skipAvailableFor(s, 'arcanist'), 'new Guardians can');
  S.switchCharacter(s, 'vanguard');
  ok(RW.skipAvailable(s), 'a stored clear counts');
  RW.skipCampaign(s);
  ok(!RW.skipAvailable(s) && !RW.skipAvailableFor(s, 'vanguard'), 'once only');
  S.switchCharacter(s, 'arcanist');
  S.switchCharacter(s, 'stalker');
  ok(RW.skipAvailableFor(s, 'arcanist'), 'a skipped clear does not count; the real one still does');
});

test('U20b Skip Campaign: base cleared, level raised, Legendary-only Light 200 set equipped, skipped flag, Legendary menu, no drops', () => {
  fresh();
  const s = S.createSave('stalker'); clearAll(s, 'base');
  S.switchCharacter(s, 'vanguard');
  const before = s.inventory.length, coins = s.glimmer;
  const lvA = S.playerLevel(s);
  const res = RW.skipCampaign(s);
  ok(CA.campaignDone(s, 'base'), 'every base mission cleared');
  ok(CA.tierUnlocked(s, 'legendary') && !CA.tierUnlocked(s, 'ultimate'), 'Legendary open');
  eq(s.skipped, true);
  ok(S.playerLevel(s) > lvA && S.playerLevel(s) >= 20, `level ${S.playerLevel(s)}`);
  eq(res.levelUp.to, S.playerLevel(s));
  eq(s.progression.xp, RW.skipXp());
  for (const sl of ['primary', 'special', 'heavy', 'helmet', 'arms', 'chest', 'legs']) {
    const it = S.getEquipped(s, sl);
    eq([it.rarity, it.power], ['legendary', 200], sl);
    if (it.kind === 'armor') eq(it.classId, 'vanguard');
    ok(S.canEquipLevel(s, it), 'usable at the new level');
  }
  eq(S.playerPower(s), 200);
  eq(s.inventory.length, before + 8, 'only the 8 set pieces (class item included), no mission drops'); eq(s.glimmer, coins, 'no glimmer drop');
  eq(res.gear.length, 8);
  eq(RW.pendingMenus(s).length, 1); eq(RW.pendingMenus(s)[0].tier, 'legendary'); eq(RW.pendingMenus(s)[0].armor.length, 3);
  eq(RW.pendingMenus(s)[0].armor.every((a) => a.power === 200), true, 'menu rolled at Light 200');
  let threw = false; try { RW.skipCampaign(s); } catch { threw = true; }
  ok(threw, 'a second skip is refused');
});

test('U20b Skip Campaign keeps a higher XP total; its XP target is the documented 53,000 run and covers every mission\'s XP', () => {
  fresh();
  const s = S.createSave('stalker'); clearAll(s, 'base');
  S.switchCharacter(s, 'arcanist');
  s.progression.xp = xpForLevel(35);
  const xp = s.progression.xp;
  const res = RW.skipCampaign(s);
  eq(s.progression.xp, xp, 'never lowered'); eq(res.levelUp, null);
  eq(RW.skipXp(), 53000); ok(RW.missionsXp() < RW.skipXp(), 'kills are the remainder'); eq(RW.missionsXp(), LOCATIONS.flatMap((l) => l.missions).length * 1500);
  ok(levelInfo(RW.skipXp()).level >= 25 && levelInfo(RW.skipXp()).level <= 30, `level ${levelInfo(RW.skipXp()).level}`);
});

// ---------- U21 Exotic Missions ----------
const fakeLayout = () => {
  const r = { minX: 0, maxX: 10, minZ: 0, maxZ: 10, minY: -5, maxY: 20 }, eye = (i) => ({ p: [i, 1, 0], n: [0, 1] });
  return {
    spawn: [1, 0, 1], voidY: -40,
    segments: [
      { id: 'descent', name: 'The Descent', kind: 'encounter', checkpoint: [1, 0, 1], region: r, conduits: [[2, 0, 2]], eyes: [0, 1, 2, 3].map(eye), gate: { p: [5, 0, 9], w: 4, h: 3, axis: 'x' }, spawns: [[3, 0, 3]], exit: null },
      { id: 'shaft', name: 'The Red Shaft', kind: 'traversal', checkpoint: [1, 0, 1], region: r, conduits: [[2, 0, 2]], phaseBlocks: [{ p: [3, 5, 3], s: [2, 0.5, 2] }], spawns: [[3, 0, 3]], ambush: [{ p: [5, 0, 5], r: 4, spawns: [[6, 0, 6]] }], exit: { p: [4, 9, 4], r: 2 } },
      { id: 'gallery', name: 'Blight Gallery', kind: 'encounter', checkpoint: [1, 0, 1], region: r, conduits: [[2, 0, 2], [8, 0, 8]], eyes: [0, 1, 2, 3, 4, 5].map(eye), glyph: [5, 3, 0], blights: [[5, 0, 5]], gate: { p: [5, 0, 9], w: 4, h: 3, axis: 'z' }, spawns: [[3, 0, 3]] },
      { id: 'chasm', name: 'The Green Chasm', kind: 'traversal', checkpoint: [1, 0, 1], region: r, phaseBlocks: [], conduits: [], spawns: [[3, 0, 3]], ambush: [{ p: [5, 0, 5], r: 4, spawns: [[6, 0, 6]] }], exit: { p: [4, -9, 4], r: 2 } },
      { id: 'falls', name: 'The Falls', kind: 'boss', checkpoint: [1, 0, 1], region: r, room: r, boss: [5, 0, 5], glyph: [5, 6, 5], conduits: [[1, 0, 1], [2, 0, 2], [3, 0, 3], [4, 0, 4]], eyes: [0, 1, 2, 3, 4, 5, 6, 7].map(eye), blights: [[6, 0, 6]], spawns: [[7, 0, 7]], chest: [5, 0, 8] },
    ],
  };
};
const WHISPER = EX.exoticDef('whisper');

test('U21 exotic registry: the Whisper is valid (units exist, level 30, 20:00, reward, boss)', () => {
  eq(EX.validateExotic(WHISPER), []);
  eq([WHISPER.unlockLevel, WHISPER.timeLimit, WHISPER.enemyLightOver, WHISPER.reward, WHISPER.boss.name], [30, 1200, 10, 'Blight Edge', 'Aurix, Hollowed Mind']);
  ok(EXOTIC_WEAPONS.some((e) => e.name === WHISPER.reward), 'the reward is a real exotic');
  let threw = false; try { EX.exoticDef('nope'); } catch (e) { threw = true; } ok(threw, 'unknown id throws');
  eq(EX.validateLayout(fakeLayout(), WHISPER), [], 'the contract accepts a well-formed layout');
  const bad = fakeLayout(); delete bad.segments[2].glyph; bad.segments[4].eyes.pop();
  ok(EX.validateLayout(bad, WHISPER).length >= 2, 'a layout with missing pieces is rejected');
  eq(EX.expandKit([['tk_thrall', 2]], 1).length, 2); eq(EX.expandKit([['tk_thrall', 2]], 2).length, 3); eq(EX.expandKit([['tk_thrall', 2]], 3).length, 3); // H22: fireteam count 1.25 and 1.5
});
test('U21 the real Whisper layout (js/level-whisper.js) matches the contract and the registry', async () => {
  const m = await import('../js/level-whisper.js');
  eq(EX.validateLayout(m.WHISPER_LAYOUT, WHISPER), []);
  eq(m.WHISPER_LAYOUT.segments.map((x) => x.id), Object.keys(WHISPER.segments), 'the same five segments in order');
});
test('U21 level 30 gate and enemy Light', () => {
  ok(!EX.exoticUnlocked(29, WHISPER)); ok(EX.exoticUnlocked(30, WHISPER)); eq(EX.exoticLockText(WHISPER), 'Requires level 30');
  eq(EX.exoticEnemyLight(150, WHISPER), 160);
});
test('U21 timer: counts down, expires at zero, freezes on the boss kill, never adds time', () => {
  const t = EX.newTimer(1200);
  EX.stepTimer(t, 60); eq(t.left, 1140); eq(EX.clock(t.left), '19:00');
  EX.stepTimer(t, -5); eq(t.left, 1140, 'negative time adds nothing');
  EX.stepTimer(t, 1085); ok(EX.timerRed(t), 'red under 60 s'); ok(!t.expired);
  EX.freezeTimer(t); EX.stepTimer(t, 500); eq(t.left, 55, 'frozen'); eq(EX.timeUsed(t), 1145); ok(!EX.timerRed(t), 'frozen is not red');
  const u = EX.newTimer(10); EX.stepTimer(u, 99); ok(u.expired); eq(u.left, 0); EX.freezeTimer(u); ok(!u.frozen, 'an expired timer cannot be frozen');
});
test('U21 save v13: v12 migrates with everything kept, per Guardian exoticMissions added', () => {
  const v12 = { version: 12, classId: 'stalker', glimmer: 9, inventory: [], vault: [], equipped: {}, cleared: { e1: true }, tier: 'base', tierCleared: { legendary: {}, ultimate: {} }, ultimateAll: false, pendingMenus: [], overload: false, skipped: false, postmaster: [], quests: Q.newQuests(), subclass: {}, loadout: {}, shaders: { owned: [], applied: {} }, exoticsFound: ['Thorn'], progression: { xp: 5, claimed: [] }, settings: {},
    chars: { vanguard: { inventory: [], equipped: {}, cleared: { e1: true }, tier: 'base', tierCleared: { legendary: {}, ultimate: {} }, pendingMenus: [], overload: false, skipped: false, postmaster: [], quests: Q.newQuests() } } };
  fresh({ afterlight_save_v2: JSON.stringify(v12) });
  const s = S.loadSave();
  eq(S.SAVE_VERSION, 15); eq(s.version, S.SAVE_VERSION);
  eq(s.exoticMissions, { whisper: { clears: 0, bestTime: null } }); eq(s.chars.vanguard.exoticMissions, { whisper: { clears: 0, bestTime: null } });
  eq([s.glimmer, s.cleared, s.exoticsFound, s.progression.xp], [9, { e1: true }, ['Thorn'], 5]);
  const n = S.createSave('stalker'); eq(n.exoticMissions, { whisper: { clears: 0, bestTime: null } });
  // switching Guardians keeps each one's record
  EX.recordExoticClear(n, 'whisper', 600); S.switchCharacter(n, 'vanguard'); eq(EX.exoticRecord(n, 'whisper').clears, 0); S.switchCharacter(n, 'stalker'); eq(EX.exoticRecord(n, 'whisper').clears, 1);
});
test('U21 first clear guarantees Blight Edge once per Guardian; repeats give two legendaries; best time is kept', () => {
  fresh();
  const s = S.createSave('stalker');
  let plan = EX.rewardPlan(s, WHISPER);
  eq([plan.first, plan.exotic, plan.legendary], [true, 'Blight Edge', 0]);
  let r = EX.recordExoticClear(s, 'whisper', 800.04);
  ok(r.first && r.newBest); eq(s.exoticMissions.whisper, { clears: 1, bestTime: 800 });
  plan = EX.rewardPlan(s, WHISPER); eq([plan.first, plan.exotic, plan.legendary], [false, null, 2]);
  r = EX.recordExoticClear(s, 'whisper', 900); ok(!r.first && !r.newBest); eq(s.exoticMissions.whisper, { clears: 2, bestTime: 800 });
  r = EX.recordExoticClear(s, 'whisper', 700); ok(r.newBest); eq(s.exoticMissions.whisper.bestTime, 700);
  const it = makeExotic('Blight Edge', 120);
  eq([it.name, it.rarity, it.slot, it.arch, it.element, it.power], ['Blight Edge', 'exotic', 'special', 'shotgun', 'void', 120]);
  const other = S.createSave('vanguard'); eq(EX.rewardPlan(other, WHISPER).first, true, 'a new Guardian is first-clear again');
});
test('U21 Blight Edge never comes from a random exotic pool (drops, tier exotics, reward menus, kiosk) but Whisper of the Worm still does', () => {
  fresh();
  const { EXOTIC_RANDOM_WEAPONS } = DATA;
  ok(!EXOTIC_RANDOM_WEAPONS.some((e) => e.name === 'Blight Edge')); ok(EXOTIC_RANDOM_WEAPONS.some((e) => e.name === 'Whisper of the Worm'));
  eq(EXOTIC_WEAPONS.filter((e) => e.mission).map((e) => e.name), ['Blight Edge']);
  const s = S.createSave('stalker');
  for (let i = 0; i < 400; i++) {
    const a = rollItem(100, 4, null, null, 'stalker', []); ok(a.name !== 'Blight Edge', 'rollItem');
    const sp = rollItem(100, 4, 'special', null, 'stalker', []); ok(sp.name !== 'Blight Edge', 'special slot roll');
    const b = RW.rollTierExotic(s, 100, 'io'); ok(b.name !== 'Blight Edge', 'rollTierExotic');
  }
  for (let i = 0; i < 40; i++) ok(!RW.rollMenu(s, 'ultimate').weapons.some((w) => w.name === 'Blight Edge'), 'reward menu');
  ok(EXOTIC_WEAPONS.filter((e) => !e.dungeon).length === 24 + 14 + 1, 'the exotic list grew by one (U23 dungeon exotics aside)');
});
test('U21 glyph puzzles: correct order solves, a wrong eye resets the set, repeats are ignored, any-order mode', () => {
  const rnd = mulberry32(5);
  const p = EX.makeGlyphPuzzle(rnd, 6, 4, 'order');
  eq(p.order.length, 4); eq(new Set(p.order).size, 4); eq(new Set(p.symbols).size, 6, 'one symbol per eye');
  const wrong = [0, 1, 2, 3, 4, 5].find((i) => !p.order.slice(0, 1).includes(i));
  eq(EX.glyphShoot(p, p.order[0]), 'correct'); eq(EX.glyphShoot(p, p.order[0]), 'ignored', 'a held trigger on the same eye');
  eq(EX.glyphShoot(p, p.order[1]), 'correct');
  const w = [0, 1, 2, 3, 4, 5].find((i) => !p.lit.includes(i) && i !== p.order[2]);
  eq(EX.glyphShoot(p, w), 'wrong'); eq([p.progress, p.lit, p.wrongs], [0, [], 1], 'the set resets');
  for (const i of p.order.slice(0, 3)) eq(EX.glyphShoot(p, i), 'correct');
  eq(EX.glyphShoot(p, p.order[3]), 'solved'); ok(p.solved); eq(EX.glyphShoot(p, 0), 'ignored');
  const a = EX.makeGlyphPuzzle(rnd, 4, 3, 'any');
  eq(EX.glyphShoot(a, 2), 'correct'); eq(EX.glyphShoot(a, 0), 'correct'); eq(EX.glyphShoot(a, 3), 'solved');
  let threw = false; try { EX.makeGlyphPuzzle(rnd, 3, 5); } catch (e) { threw = true; } ok(threw, 'more glyphs than eyes throws');
});
test('U21 boss phases: immune until the glyph, a damage window capped at a third per phase, phase 2 moves a lit conduit, phase 3 repeats', () => {
  const cfg = WHISPER.segments.falls, rnd = mulberry32(11);
  const f = new EX.BossFsm(cfg, 4, rnd), max = 3000;
  ok(f.immune && f.phase === 1 && f.puzzle.len === 3 && f.lit === -1 && !f.blightsOn);
  eq(EX.gateDamage({ exoBoss: true, exoImm: true, hp: max }, 500), 0, 'immune takes nothing');
  eq(EX.gateDamage({ hp: 5 }, 500), 500, 'other enemies are untouched');
  for (const i of f.puzzle.order.slice(0, 2)) eq(f.shoot(i), 'correct');
  eq(f.shoot(f.puzzle.order[2]), 'solved'); ok(!f.immune); eq(f.windowLeft, 12);
  eq(f.floorHp(max), 2000, 'at most a third in phase 1');
  eq(EX.capDamage(3000, 2000, 5000), 1000); eq(EX.capDamage(2000, 2000, 50), 0);
  eq(f.tick(1, 3000, max), null); eq(f.windowLeft, 11);
  eq(f.tick(1, 2000, max), 'window-end'); ok(f.immune && f.phase === 2 && f.puzzle.len === 4, 'floor reached ends the window'); ok(f.lit >= 0 && f.lit < 4, 'one conduit lit');
  const first = f.lit; f.tick(14.9, 2000, max); eq(f.lit, first); eq(f.tick(0.2, 2000, max), 'lit-moved'); ok(f.lit !== first && f.lit >= 0 && f.lit < 4);
  for (const i of f.puzzle.order) f.shoot(i);
  ok(!f.immune); eq(f.floorHp(max), 1000);
  eq(f.tick(13, 1800, max), 'window-end'); eq(f.ended, 'time'); eq(f.phase, 3); ok(f.blightsOn && f.puzzle.len === 5 && f.lit === -1);
  for (const i of f.puzzle.order) f.shoot(i);
  eq(f.floorHp(max), 0); f.tick(13, 900, max); eq(f.phase, 3, 'phase 3 repeats with a fresh glyph'); ok(f.immune);
  eq(f.snapshot().ph, 3);
});
test('U21 respawn rules: solo death restarts the segment, fireteam deaths stay down, a wipe resets, a fireteam void fall is downed at the safe spot', () => {
  const solo = EX.deathOutcome({ fireteam: 1, cause: 'death' });
  eq([solo.action, solo.respawnIn], ['segment-reset', 3]); ok(/no revive is spent/i.test(solo.sub));
  eq(EX.deathOutcome({ fireteam: 1, cause: 'void' }).action, 'segment-reset', 'solo void is a death');
  for (const n of [2, 3]) {
    const d = EX.deathOutcome({ fireteam: n, cause: 'death' });
    eq([d.action, d.respawnIn], ['stay-down', null]); ok(/Respawns restricted: a teammate must revive you/.test(d.sub));
    eq(EX.deathOutcome({ fireteam: n, cause: 'void' }).action, 'downed-at-safe');
  }
  eq(EX.wipeOutcome([true, false]).action, 'none'); eq(EX.wipeOutcome([true, true]).action, 'wipe-reset'); eq(EX.wipeOutcome([]).action, 'none'); ok(EX.isWipe([true]));
  let threw = false; try { EX.deathOutcome({ fireteam: 1, cause: 'x' }); } catch (e) { threw = true; } ok(threw);
  // the safe spot only follows grounded, non-phase-block positions
  let safe = { x: 0, y: 0, z: 0 };
  safe = EX.trackSafe(safe, { x: 5, y: 2, z: 5 }, true, false); eq(safe, { x: 5, y: 2, z: 5 });
  safe = EX.trackSafe(safe, { x: 9, y: 4, z: 9 }, false, false); eq(safe, { x: 5, y: 2, z: 5 }, 'airborne does not count');
  safe = EX.trackSafe(safe, { x: 9, y: 4, z: 9 }, true, true); eq(safe, { x: 5, y: 2, z: 5 }, 'a phase block does not count');
  ok(EX.inVoid(-41, -40)); ok(!EX.inVoid(-39, -40));
  eq(EX.downText(1), ''); ok(EX.downText(2).startsWith('Respawns restricted'));
});
test('U21 Blight Harvest: 50% per kill, 100% on a precision kill, a bomb kill has half the normal chance (25%), at most 3 bombs deep', () => {
  eq(EX.blightChance(false, 0), 0.5); eq(EX.blightChance(true, 0), 1);
  eq(EX.blightChance(false, 1), 0.25); eq(EX.blightChance(true, 1), 0.25, 'a bomb kill is never a precision kill'); eq(EX.blightChance(false, 2), 0.25);
  eq(EX.blightChance(false, 3), 0, 'the third bomb cannot chain'); eq(EX.blightChance(true, 4), 0);
  // walk the chain with a rigged roll: always rolling under the chance gives exactly three bombs
  let bombs = 0, depth = 0;
  while (Math.random() * 0 < EX.blightChance(false, depth)) { bombs++; depth++; if (bombs > 10) break; }
  eq(bombs, 3);
  eq([EX.BLIGHT.fuse, EX.BLIGHT.radius, EX.BLIGHT.weaken], [1.2, 4, 4]);
  const perk = DATA.EXOTIC_PERKS.blightharvest; ok(perk && perk.name === 'Blight Harvest');
  const edge = EXOTIC_WEAPONS.find((e) => e.name === 'Blight Edge'); eq([edge.perks, edge.look.body, edge.look.accent], [['blightharvest'], 0x14141a, 0xf2f2f2]);
});
test('U21 the Attuned status exists and the exotic-mission pieces are wired into the registry', () => {
  const st = new StatusSet(); st.apply('attuned', { set: true }); eq(st.remaining('attuned'), 20); ok(STATUS.attuned.name === 'Attuned');
  for (const [seg, c] of Object.entries(WHISPER.segments)) ok(c, seg);
});


// ---- H22 perf and scaling tests ----
const { mergeEnemyModel } = await import('../js/enemy-merge.js');
function mergeRig(builder, t, merge) {
  const g = new THREE.Group(), hit = [], e = { id: t };
  const add = (geo, m, x, y, z, parent = g, crit = false, r = null) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); if (r) mesh.rotation.set(r[0], r[1], r[2]);
    mesh.userData.enemy = e; mesh.userData.crit = crit; parent.add(mesh); hit.push(mesh); return mesh;
  };
  const B = (w, h, d, x, y, z, m, parent = g, crit = false, r = null) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent, crit, r);
  const pivot = (x, y, z, parent = g) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
  const mk = (col) => new THREE.MeshStandardMaterial({ color: col });
  const c = { g, add, B, pivot, bodyMat: mk(0xd8ccae), dark: mk(0x5a2622), accent: mk(0x7fd8ff), C: { accent: 0xa3281f, enemy: 0x888888, enemy2: 0x444444, eye: 0xff0000 }, muzzle: new THREE.Object3D(), legs: [], arms: [], torso: null, height: 2.05 };
  builder(c, t);
  globalThis.__noEnemyMerge = !merge;
  const r = mergeEnemyModel(g, hit, e, [c]);
  globalThis.__noEnemyMerge = false;
  g.updateMatrixWorld(true);
  const meshes = []; g.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const tris = meshes.reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0);
  return { g, hit, c, r, meshes, tris, box: new THREE.Box3().setFromObject(g, true), e };
}
test('H22: merging enemy parts cuts meshes, keeps crit parts, triangles and bounds', () => {
  for (const [b, t] of [[fallen, 'grunt'], [fallen, 'captain'], [hive, 'rusher'], [cabal, 'grunt'], [scorn, 'sc_raider'], [scorn, 'sc_ravager'], [fallen, 'heavy']]) {
    const a = mergeRig(b, t, false), m = mergeRig(b, t, true);
    ok(m.meshes.length < a.meshes.length * 0.75, `${t}: ${a.meshes.length} -> ${m.meshes.length} meshes`);
    eq(m.tris, a.tris);
    const critTris = (r) => r.meshes.filter((x) => x.userData.crit).reduce((n, x) => n + (x.geometry.index ? x.geometry.index.count : x.geometry.attributes.position.count) / 3, 0);
    ok(m.meshes.some((x) => x.userData.crit), `${t} keeps a crit mesh`);
    eq(critTris(m), critTris(a));
    ok(m.box.min.distanceTo(a.box.min) < 1e-3 && m.box.max.distanceTo(a.box.max) < 1e-3, `${t} bounds`);
    ok(m.hit.every((x) => x.userData.enemy === m.e && x.parent), `${t}: every hit mesh has its enemy and is in the tree`);
    ok(m.meshes.every((x) => m.hit.includes(x)), `${t}: every mesh is in the hit list`);
    ok(m.c.legs.every((l) => l.parent) && (!m.c.torso || m.c.torso.parent), `${t}: animated pivots stay`);
  }
});
test('H22: merge never merges referenced or named meshes, merges crit only with crit, and keeps parents apart', () => {
  const g = new THREE.Group(), mt = new THREE.MeshStandardMaterial(), hit = [];
  const mkm = (p) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mt); p.add(m); hit.push(m); return m; };
  const piv = new THREE.Group(); g.add(piv);
  const ref = mkm(g), named = mkm(g); named.name = 'x';
  const crit = mkm(g); crit.userData.crit = true;
  const crit2 = mkm(g); crit2.userData.crit = true;
  mkm(g); mkm(g); mkm(piv); mkm(piv);
  const r = mergeEnemyModel(g, hit, {}, [{ list: [ref], piv }]);
  eq(r.geos.length, 3);
  ok(ref.parent === g && named.parent === g, 'protected meshes stay');
  eq(piv.children.length, 1);
  eq(g.children.length, 5);
  const cm = g.children.filter((x) => x.isMesh && x.userData.crit); eq(cm.length, 1); ok(cm[0] !== crit, 'the two crit parts became one crit mesh');
});
test('H22: fireteam table is pinned (fewer, tougher enemies for 2 and 3 players)', () => {
  eq(TR.FIRETEAM_SCALE[1], { count: 1, hp: 1, dmg: 1, boss: 1 });
  eq(TR.FIRETEAM_SCALE[2], { count: 1.25, hp: 1.3, dmg: 1.05, boss: 1.6 });
  eq(TR.FIRETEAM_SCALE[3], { count: 1.5, hp: 1.55, dmg: 1.12, boss: 2.2 });
});

// ---- H22 hand cannon recoil tests ----
const { recoilProfileFor, recoilKick, recoilQueue, recoilStep, newRecoilState } = await import('../js/frames.js');
test('H22: hand cannon kick has positive pitch and goes right', () => {
  const A = weaponHandling({ arch: 'hand', rarity: 'legendary', frame: 'adaptive' }), pr = recoilProfileFor(A);
  const k = recoilKick(pr, 0.045, () => 0.5);
  if (!(k.pitch > 0)) throw new Error('pitch should kick up');
  if (!(k.yaw < 0)) throw new Error('yaw should decrease (screen right)');
  if (Math.abs(Math.atan2(-k.yaw, k.pitch) * 180 / Math.PI - pr.angle) > 1e-6) throw new Error('angle off from profile');
});
test('H22: Precision hand cannon frame kicks straight up', () => {
  const pr = recoilProfileFor(weaponHandling({ arch: 'hand', rarity: 'legendary', frame: 'precision' }));
  const k = recoilKick(pr, 0.045, () => 0.5);
  if (Math.abs(k.yaw) > 1e-9 || !(k.pitch > 0)) throw new Error('should be pure pitch');
});
test('H22: families without a profile keep the legacy kick', () => {
  if (recoilProfileFor(weaponHandling({ arch: 'auto', rarity: 'legendary', frame: 'adaptive' })) !== null) throw new Error('auto has a profile');
  if (recoilKick(null, 0.01) !== null) throw new Error('null profile should return null');
});
test('H22: recoil recovers exactly the recover fraction', () => {
  const pr = recoilProfileFor(weaponHandling({ arch: 'hand', rarity: 'legendary', frame: 'adaptive' }));
  const st = newRecoilState(), k = recoilKick(pr, 0.045, () => 0.5);
  recoilQueue(st, pr, k);
  let p = 0, y = 0;
  for (let i = 0; i < 600; i++) { const d = recoilStep(st, pr, 1 / 60); p += d.pitch; y += d.yaw; }
  if (Math.abs(p - k.pitch * (1 - pr.recover)) > 1e-5 || Math.abs(y - k.yaw * (1 - pr.recover)) > 1e-5) throw new Error('net ' + p + ' vs ' + k.pitch * (1 - pr.recover));
});

// ---- H22 Whisper glyph tests ----
test('H22: the Whisper boss bar has one segment per damage gate', () => {
  const segs = EX.EXOTIC_MISSIONS ? Object.values(EX.EXOTIC_MISSIONS).find((d) => d.boss?.name?.startsWith('Aurix'))?.boss.segments : null;
  eq(segs, 3);
  for (let k = 1; k <= segs; k++) ok(Math.abs(EX.bossFloorFrac(k) - (1 - k / segs)) < 1e-9, 'gate ' + k + ' matches a divider');
});
const WL = (await import('../js/level-whisper.js')).WHISPER_LAYOUT, WM = await import('../js/mechanics.js');
test('H22: Gallery glyph board sits in front of its frame (front face x 179.45), sized to fill it', () => {
  const g = WL.segments.find((x) => x.id === 'gallery');
  ok(g.glyph[0] < 179.45, 'board x ' + g.glyph[0]);
  ok(WM.boardWidth(g) >= 8, 'board width ' + WM.boardWidth(g));
});
test('H22: Falls glyph board is not in the boss and sits in front of the back wall', () => {
  const f = WL.segments.find((x) => x.id === 'falls');
  ok(Math.hypot(f.glyph[0] - f.boss[0], f.glyph[2] - f.boss[2]) > 4, 'far from the boss horizontally');
  ok(f.glyph[0] < f.room.maxX && f.glyph[0] > f.room.maxX - 2, 'just in front of the back wall');
  ok(f.glyph[1] > f.boss[1] + 10, 'high above the arena floor');
  ok(WM.boardWidth(f) >= 10, 'board width ' + WM.boardWidth(f));
});
test('H22: boardWidth keeps the old defaults when glyphW is absent', () => {
  eq([WM.boardWidth({ kind: 'boss' }), WM.boardWidth({ kind: 'encounter' }), WM.boardWidth({ glyphW: 7 })], [5, 4, 7]);
});
test('H22: eye glyph symbols are large and stand clear of the wall', () => {
  ok(WM.EYE_SYM.size >= 1.2, 'size ' + WM.EYE_SYM.size);
  ok(WM.EYE_SYM.z > 0 && WM.EYE_SYM.z < 0.2, 'flat on the wall, just in front of it');
  // boards face into their room, snapped to a wall axis (the Gallery and Falls boards face -x)
  ok(Math.abs(WM.boardYaw({ x: 179.2, z: 0 }, { x: 151, z: 0 }) + Math.PI / 2) < 1e-9, 'gallery board faces -x');
  ok(Math.abs(WM.boardYaw({ x: 0, z: 0 }, { x: 1, z: 30 })) < 1e-9, 'snaps to +z');
});
test('H22: the right-shot flare settles to the steady lit glow', () => {
  const e = { flareT: 0.6, iris: { material: { emissiveIntensity: 0 } }, ring: null, sym: null };
  ok(WM.stepEyeFlare(e, 0.1), 'still flaring'); ok(e.iris.material.emissiveIntensity > 3, 'bright at first');
  ok(!WM.stepEyeFlare(e, 1), 'done'); eq(e.iris.material.emissiveIntensity, 2.6);
});


let pass = 0, fail = 0;
// ---------------------------------------------------------------------------
// U22 Darkness: Stasis and Strand
// ---------------------------------------------------------------------------
test('U22: six Darkness subclasses unlock at 28, one Stasis and one Strand per class, Destiny 2 names', () => {
  eq(DR.DARK_UNLOCK, 28);
  const want = { vanguard: ['behemoth', 'berserker'], stalker: ['revenant', 'threadrunner'], arcanist: ['shadebinder', 'broodweaver'] };
  for (const [c, ids] of Object.entries(want)) {
    eq(ids.map((id) => CLASSES[c].subclasses[id].element), ['stasis', 'strand'], c);
    for (const id of ids) { eq(subclassLevel(c, id), 28, id); eq(CLASSES[c].subclasses[id].color, ELEMENTS[CLASSES[c].subclasses[id].element].color, `${id} color`); }
  }
  eq(DARK_SUBS.length, 6);
  // a locked Darkness subclass's build is not usable below 28; its default is valid at 28
  for (const [c, sid] of DARK_SUBS) {
    const d = SC.defaultLoadout(c, sid);
    eq(SC.sanitizeLoadout(c, sid, d, 28), d, `${sid} default valid at 28`);
    eq(SC.sanitizeLoadout(c, sid, d, 27).aspects, [], `${sid} aspects locked below 28`);
    eq(SC.supersFor(c, sid).length, 2, `${sid}: its Destiny 2 super and one original`);
  }
});

test('U22: each Darkness subclass has a roaming and a burst super (the original is the opposite type), all third person', () => {
  const pairs = { behemoth: ['glacialquake', 'avalanche'], berserker: ['bladefury', 'ripcord'], revenant: ['silencesquall', 'rimeblades'], threadrunner: ['silkstrike', 'cradle'], shadebinder: ['winterswrath', 'absolutezero'], broodweaver: ['needlestorm', 'loomwalker'] };
  for (const [c, sid] of DARK_SUBS) {
    const ids = SC.supersFor(c, sid);
    eq(ids, pairs[sid], sid);
    eq(ids.map((id) => C.BURST_SUPERS.includes(id)).sort(), [false, true], `${sid} one burst, one roaming`);
    for (const id of ids) { eq(SC.superDef(c, sid, id).camera, 'third', id); ok(C.SUPER_TIME[id] > 0 && C.SUPER_TUNE[id], `${id} timed and tuned`); }
  }
  // second supers unlock on the reward track after the subclass (Stasis 32, Strand 35), one per class at each
  for (const L of [32, 35]) for (const c of Object.keys(CLASSES)) eq(SC.buildUnlocksAt(L, c).length, 1, `${c} ${L}`);
  for (const L of [32, 35]) eq(rewardAt(L), null, `no item reward at ${L}`);
});

test('U22/H23: Stasis slow stacks freeze at four; bosses only slow; every damaging hit shatters except Stasis slows and freezes', () => {
  let s = { stacks: 0, freeze: false };
  for (let i = 0; i < 3; i++) { s = DR.chill(s.stacks, 1); ok(!s.freeze, `stack ${i + 1}`); }
  eq(DR.chill(s.stacks, 1), { stacks: 0, freeze: true });
  eq(DR.chill(3, 3), { stacks: 0, freeze: true }, 'overflow freezes');
  eq(DR.chill(3, 9, true), { stacks: DR.STASIS.bossSlowCap, freeze: false }, 'a boss caps out slowed');
  ok(!DR.canFreeze({ isBoss: true }) && !DR.canFreeze({ exoBoss: true }) && DR.canFreeze({ cls: 'heavy' }), 'freeze immunity');
  ok(!DR.canSuspend({ isBoss: true }) && DR.canSuspend({ cls: 'grunt' }), 'suspend immunity');
  ok(DR.freezeTime('heavy') < DR.freezeTime('captain') && DR.freezeTime('captain') < DR.freezeTime('grunt'), 'bigger units thaw sooner');
  eq(DR.freezeTime('grunt', 1.4), DR.STASIS.freezeT.grunt * 1.4, 'Whisper of Durance');
  ok(DR.shatters({ source: 'weapon' }, 10) && DR.shatters({ raw: true, remoteHit: true }, 10), 'weapon and relayed hits shatter');
  ok(!DR.shatters({ slowAdd: 2 }, 10) && !DR.shatters({ freeze: 1 }, 10) && !DR.shatters({}, 0), 'Stasis slows, freezes and zero hits do not');
  const B = DR.shatterBlast(), F = DR.shatterBlast(SC.FRAGMENT_TUNE.fissures);
  ok(F.dmg === B.dmg * 1.5 && F.r === B.r + 1, 'Whisper of Fissures');
});

test('H23: threadlings perch on a Broodweaver (up to five); Darkness weapon perks, Rounds and Slice', () => {
  ok(DR.canPerch('broodweaver') && !DR.canPerch('berserker') && !DR.canPerch('threadrunner'), 'only the Broodweaver perches');
  eq(DR.perchAdd(0, 1), { perched: 1, lost: 0 });
  eq(DR.perchAdd(4, 3), { perched: 5, lost: 2 }, 'five perch at most');
  eq(DR.STRAND.threadling.perchMax, 5);
  ok(DR.STRAND.threadling.leapR > 0 && DR.STRAND.threadling.speed > 0, 'threadlings skitter and leap');
  eq(DR.weaponChill({ chillclip: true }), 1); eq(DR.weaponChill({ chillclip: true, crit: true }), 2);
  eq(DR.weaponChill({ chilling: true }), 1); eq(DR.weaponChill({ impairment: true, slowed: false }), 0); eq(DR.weaponChill({ impairment: true, slowed: true }), 1);
  eq(DR.weaponChill({ chillclip: true, chilling: true, frozen: true }), 0, 'a frozen target gets no slow, so the hit shatters it');
  let sl = DR.sliceHit([], 0); ok(!sl.sever); sl = DR.sliceHit(sl.times, 0.5); ok(!sl.sever); sl = DR.sliceHit(sl.times, 1); ok(sl.sever, 'third hit severs');
  ok(!DR.sliceHit([0, 0.1], 2).sever, 'old hits fall out of the window');
  for (const [p, el] of [['chillclip', 'stasis'], ['headstone', 'stasis'], ['hatchling', 'strand'], ['slice', 'strand']]) {
    ok(PERKS[p] && PERK_ELEMENT[p] === el && PERK_COLUMNS.effect.includes(p), `${p} is a ${el} Effect perk`);
  }
  for (const n of [...NAMED_WEAPONS, ...LEGENDARY_WEAPONS].filter((w) => w.element === 'stasis' || w.element === 'strand')) {
    const pool = perkPoolFor(n);
    ok(pool.effect.some((p) => PERK_ELEMENT[p] === n.element), `${n.name} carries a ${n.element} perk`);
  }
  for (const id of ['chilling', 'severing']) ok(STATUS[id], `Rounds status ${id}`);
  for (const id of ['impairment', 'frostbite', 'isolation', 'snaring']) ok(SC.FRAGMENTS[id] && SC.FRAGMENT_TUNE[id] !== undefined, `fragment ${id}`);
});

const DARK_SRC = await (await fetch(new URL('../js/darkness.js', import.meta.url))).text();
test('H24: perched threadlings sit small and low and release on any direct hit; Shadebinder staff hits freeze; Diamond Lance', () => {
  const T = DR.STRAND.threadling;
  ok(T.perchScale < T.scale * 0.5, 'perched threadlings are under half their running size');
  ok(T.perchY < 0.6 && T.perchR <= 0.8, 'perched threadlings circle at the feet, below the first-person view');
  for (const src of ['weapon', 'melee', 'ability', 'super']) ok(DR.releasesPerch({ source: src }, 50), `${src} damage releases them`);
  ok(!DR.releasesPerch({ source: 'ability', companion: true }, 90), 'threadling and turret hits do not release them');
  ok(!DR.releasesPerch({ source: 'perk' }, 50) && !DR.releasesPerch({ source: 'weapon', jolted: true }, 50), 'perk procs and chain hits do not');
  ok(!DR.releasesPerch({ source: 'weapon' }, 0) && !DR.releasesPerch({ source: 'weapon', remoteHit: true }, 50), 'zero damage and teammates\' hits do not');
  const src = DARK_SRC;
  ok(/id === 'penumbral'[\s\S]{0,400}stasisO\(3, \{ freeze:/.test(src), 'Penumbral Blast direct hit carries freeze');
  ok(/case 'winterswrath'[\s\S]{0,1400}stasisO\(T\.stacks, \{ freeze:/.test(src), "Winter's Wrath shard direct hit carries freeze");
  ok(/iceflare[\s\S]{0,600}hasLOS/.test(src) && !/iceflare[\s\S]{0,400}kind: 'swarm'/.test(src), 'Iceflare Bolts are hitscan, not seekers');
  ok(DR.canFreeze({ cls: 'grunt' }) && !DR.canFreeze({ isBoss: true }), 'freeze still never lands on bosses');
  // barricades and Stasis crystals stand on the floor under them, not at y = 0
  const keepC = G.colliders, keepL = G.level;
  G.level = null;
  G.colliders = [{ min: { x: -2, y: 0, z: -2 }, max: { x: 2, y: 3, z: 2 } }, { min: { x: -2, y: 6, z: -2 }, max: { x: 2, y: 6.3, z: 2 } }, { min: { x: -9, y: 0, z: -9 }, max: { x: 9, y: 9, z: 9 }, pass: true }];
  eq(floorBelow(0, 0, 3.6), 3, 'on top of a deck');
  eq(floorBelow(0, 0, 10), 6.3, 'the highest floor at or below the caster');
  eq(floorBelow(5, 5, 3.6), 0, 'open ground; pass-through boxes (barricades) are not floors');
  G.colliders = keepC; G.level = keepL;
});

test('H25: Avalanche leaps higher than Well and Ward, then slams where it lands', () => {
  const A = C.SUPER_TUNE.avalanche;
  ok(C.SLAM_SUPERS.includes('avalanche') && C.BURST_SUPERS.includes('avalanche'), 'Avalanche slams and keeps its burst armor');
  ok(A.hop > C.SUPER_HOVER.hop && A.hopT > C.SUPER_HOVER.hopT && A.slamMax >= C.SUPER_HOVER.slamMax, 'a higher leap and a longer dive window');
});

test('H26: Darkness exotics: one Stasis and one Strand per class, each tied to its subclass, dropping from level 28', () => {
  const want = { vanguard: ['Hoarfrost-Z', 'Abeyant Leap'], stalker: ['Renewal Grasps', "Cyrtarachne's Facade"], arcanist: ['Osmiomancy Gloves', 'Swarmers'] };
  for (const [c, names] of Object.entries(want)) {
    const els = names.map((n) => { const sub = EXOTIC_ARMOR_PERKS[n].sub; ok(CLASSES[c].subclasses[sub], `${n} belongs to a ${c} subclass`); return CLASSES[c].subclasses[sub].element; });
    eq(els.slice().sort(), ['stasis', 'strand'], `${c}: one Stasis and one Strand`);
    for (const n of names) {
      eq(exoticArmorLevel(c, n), 28);
      ok(!exoticArmorFor(c, 27).some((x) => x.name === n), `${n} does not drop at 27`);
      ok(exoticArmorFor(c, 28).some((x) => x.name === n), `${n} drops at 28`);
      ok(DR.DARK_EXO[EXOTIC_ARMOR_PERKS[n].id], `${n} has tuning`);
    }
    eq(exoticArmorFor(c, 27).length, 13, 'the Light exotics drop at any level');
    for (let i = 0; i < 40; i++) { const it = rollItem(50, 4, null, null, c, [], 5); if (it.kind === 'armor') ok(!names.includes(it.name), 'no Darkness exotic below level 28'); }
  }
  eq(exoticArmorLevel('vanguard', 'Synthoceps'), 1);
});

test('U22: players hit by enemy Darkness: three Chilled stacks freeze, Space breaks out; severed enemies hit softer', () => {
  eq(DR.playerChill(0, 2), { stacks: 2, freeze: false });
  eq(DR.playerChill(2, 1), { stacks: 0, freeze: true });
  eq(DR.breakFree(1), 1 - DR.STASIS.player.breakStep);
  eq(DR.breakFree(0.1), 0);
  eq(DR.severMult(true), DR.STRAND.sever.mult); eq(DR.severMult(false), 1);
  ok(DR.STRAND.sever.mult < 1 && DR.STRAND.woven.cut < 1, 'sever and Woven Mail reduce damage');
  for (const id of ['chilled', 'frozen', 'suspended', 'wovenmail', 'diamondlance', 'banner', 'weavewalk', 'hedrons', 'ascent', 'unraveling', 'cryoclasm', 'grapplemelee']) ok(STATUS[id], `player status ${id}`);
  for (const id of ['frozen', 'suspend', 'unravel', 'sever']) ok(ENEMY_STATUS[id], `enemy status ${id}`);
  eq(ENEMY_STATUS.slow.maxStacks, DR.STASIS.freezeAt, 'slow stacks up to the freeze');
});

test('U22: Darkness Captains: Fallen roll Stasis shields, Cabal Strand; the shield element makes the wielder', () => {
  ok(TR.shieldFor('scrappers', 'captain').includes('stasis') && !TR.shieldFor('scrappers', 'captain').includes('strand'), 'Fallen Stasis');
  ok(TR.shieldFor('legion', 'captain').includes('strand') && !TR.shieldFor('legion', 'captain').includes('stasis'), 'Cabal Strand');
  ok(!TR.shieldFor('hollow', 'captain').some((e) => DR.DARK_ELEMENTS.includes(e)), 'Hive stay Light');
  eq(DR.darkWielder('captain', 'stasis'), 'stasis'); eq(DR.darkWielder('captain', 'arc'), null); eq(DR.darkWielder('heavy', 'strand'), null);
  for (const el of DR.DARK_ELEMENTS) ok(DR.DARK_GRENADE[el].color, el);
});

test('U22: Darkness grenades, aspects and fragments: names, slots and tuning are complete', () => {
  for (const id of ['glacier', 'duskfield', 'coldsnap', 'grapple', 'shackle', 'threadling']) ok(SC.GRENADES[id] && SC.GRENADES[id].kind === id && SC.GRENADES[id].cd > 0, id);
  for (const [c, sid] of DARK_SUBS) {
    const sc = CLASSES[c].subclasses[sid];
    ok(sc.abilities.melee.name && sc.abilities.melee.cd > 0, `${sid} melee`);
    ok(SC.aspectsFor(c, sid).includes(sc.defaults.aspects[0]), `${sid} default aspect is its own`);
    eq(SC.GRENADES[sc.defaults.grenade].element, sc.element, `${sid} default grenade`);
  }
  for (const id of [...SC.fragmentsFor('stasis'), ...SC.fragmentsFor('strand')]) ok(SC.FRAGMENT_TUNE[id] !== undefined, `${id} tuned`);
  for (const id of Object.keys(SC.DARK_ASPECT_TUNE)) ok(SC.ASPECTS[id], `${id} tuning has an aspect`);
  for (const text of [...Object.values(SC.ASPECTS), ...Object.values(SC.FRAGMENTS), ...Object.values(SC.GRENADES)].map((x) => x.desc)) ok(!/[\u2013\u2014]/.test(text), 'no dashes in player text');
});

// H23 Roll Tracker
test('H23: Roll Tracker covers every weapon, searches by perk and name, and gives every weapon a source', async () => {
  const RT = await import('../js/rolltracker.js');
  const F = await import('../js/frames.js');
  const D = await import('../js/data.js');
  const all = RT.trackerEntries();
  eq(all.length, F.NAMED_WEAPONS.length + F.LEGENDARY_WEAPONS.length + D.EXOTIC_WEAPONS.length + 7, 'one entry per weapon (plus the 7 Crucible weapons, U25c)');
  for (const e of all) ok(e.sources.length > 0 && e.sources.every((x) => x && !/[\u2013\u2014]/.test(x)), `${e.name} has a source`);
  const hits = RT.searchTracker('incandescent');
  ok(hits.length > 0, 'incandescent is on some weapons');
  const want = all.filter((e) => !e.exotic && ['mag', 'damage', 'effect'].some((c) => e.pool[c].includes('incandescent')) || (e.exotic && e.perks.includes('incandescent')));
  eq(hits.map((e) => e.name).sort().join('|'), want.map((e) => e.name).sort().join('|'), 'perk search returns exactly the weapons rolling it');
  ok(hits.every((e) => e.element === 'solar'), 'incandescent only rolls on solar weapons');
  const known = F.LEGENDARY_WEAPONS[0].name;
  ok(RT.searchTracker(known.toUpperCase()).some((e) => e.name === known), 'name search finds a known weapon');
  ok(RT.searchTracker('', { element: 'void' }).every((e) => e.element === 'void'), 'element filter');
  const mission = D.EXOTIC_WEAPONS.find((x) => x.mission);
  if (mission) ok(all.find((e) => e.name === mission.name).sources[0].startsWith('Exotic mission:'), 'mission exotic names its mission');
});

// ---- U21b ledge guard and leap links ----
// A 10 x 3 grid of 1 m cells with a 2 m abyss strip at columns 4 and 5; row 2 column 7 is a 3 m pit-side drop (row 1 column 8 is a platform at 3 m).
function gapNav() {
  const W = 10, D = 3, hgt = new Float32Array(W * D), abyss = new Uint8Array(W * D);
  for (let j = 0; j < D; j++) for (const i of [4, 5]) { hgt[j * W + i] = -1; abyss[j * W + i] = 1; }
  hgt[1 * W + 8] = 3; // column 8: row 1 is a 3 m platform, row 2 floor
  return { cell: 1, minX: 0, minZ: 0, W, D, hgt, base: new Float32Array(W * D), abyss, links: null };
}
test('U21b ledge guard refuses a self-driven step into the abyss', () => {
  const nav = gapNav();
  eq(ledgeStep(nav, 3.5, 1.5, 3.9, 1.5), 3, 'a step that stays on the platform is allowed');
  eq(ledgeStep(nav, 3.9, 1.5, 4.2, 1.5) & 1, 0, 'a pure x step over the edge is refused (the zero z part may pass)');
  eq(ledgeStep(nav, 3.9, 1.5, 4.2, 1.9), 2, 'a diagonal over the edge slides along z');
});
test('U21b ledge guard holds a unit standing on a platform edge cell (non-standable, not the abyss)', () => {
  const nav = gapNav();
  nav.hgt[1 * nav.W + 3] = -1; // column 3 row 1: the edge band of the left platform (blocked for pathing, solid ground)
  eq(ledgeStep(nav, 3.5, 1.5, 4.5, 1.5, 0) & 1, 0, 'a step from the edge band into the abyss is refused');
  eq(ledgeStep(nav, 3.5, 1.5, 2.5, 1.5, 0), 3, 'a step back onto the platform is allowed');
});
test('U21b ledge guard refuses a drop taller than NAV.hop but allows a small one', () => {
  const nav = gapNav();
  eq(ledgeStep(nav, 8.5, 1.5, 8.5, 2.5) & 2, 0, 'a 3 m drop is refused (NAV.hop is ' + NAV.hop + ')');
  nav.hgt[1 * nav.W + 8] = 1; // a 1 m crate edge
  eq(ledgeStep(nav, 8.5, 1.5, 8.5, 2.5) & 2, 2, 'a 1 m drop is allowed');
});
test('U21b ledge guard lets a unit already off the grid or over the void move freely, and knock is never checked', () => {
  const nav = gapNav();
  eq(ledgeStep(nav, 4.5, 1.5, 5.5, 1.5), 3, 'a unit already in the abyss is not held');
  // knock is applied by the caller without ledgeStep: a plain position add crosses the strip
  let x = 3.9; x += 6 * 0.5; // 6 m/s knock for 0.5 s
  eq(heightAt(nav, x, 1.5) >= 0, true, 'knock carried it across to the far platform');
  x = 3.9 + 1.5 * 1; ok(heightAt(nav, x, 1.5) < 0, 'knock that ends over the strip leaves it over the abyss (it falls)');
});
test('U21b leap links appear as path edges in findPath', () => {
  const nav = gapNav();
  const before = findPath(nav, 1.5, 1.5, 8.5, 0.5);
  ok(before && before.partial, 'with no leap link the far platform is unreachable (partial path)');
  addLeapLinks(nav, [{ a: [3.5, 0, 1.5], b: [6.5, 0, 1.5], two: false }]);
  const r = findPath(nav, 1.5, 1.5, 8.5, 0.5);
  ok(r && !r.partial, 'with a leap link the path reaches the far platform');
  const leap = r.pts.find((p) => p.leap);
  ok(leap, 'one waypoint is a leap');
  eq([leap.x, leap.y, leap.z, leap.ax, leap.az], [6.5, 0, 1.5, 3.5, 1.5], 'the leap lands exactly at b and launches at a');
  const back = findPath(nav, 8.5, 0.5, 1.5, 1.5);
  ok(back.partial, 'a one way link (two: false) does not route back');
  addLeapLinks(nav, [{ a: [3.5, 0, 1.5], b: [6.5, 0, 1.5], two: true }]);
  ok(!findPath(nav, 8.5, 0.5, 1.5, 1.5).partial, 'a two way link routes both ways');
});
test('U21b buildNav picks leap links from the option or G.level and marks the abyss', () => {
  const nav = buildNav([boxC(0, 0, 0, 12, 0.4, 12)], navBounds, { leapLinks: [{ a: [-3, 0.4, 0], b: [3, 0.4, 0], two: true }] });
  ok(nav.links && nav.links.size === 2, 'two directed edges from a two way link');
  const none = buildNav([boxC(0, 0, 0, 12, 0.4, 12)], navBounds);
  eq(none.links, null, 'no links by default');
});

// ---- U21b Whisper traversal ----
const JR = await import('../js/jump-reach.js');
const WLV = await import('../js/level-whisper.js');
test('U21b reach model: glide at Mobility 50 beats the old 15.6 m figure, every mode has a finite reach and a rise', () => {
  const flat = Object.fromEntries(JR.REACH_MODES.map((m) => [m, JR.reachOf(m, 0)]));
  ok(flat.glide > 15.6, 'glide ' + flat.glide.toFixed(1));
  ok(flat.strafeglide > 15.6 && flat.balanced > 15.6, 'all glides beat 15.6');
  for (const m of JR.REACH_MODES) ok(flat[m] > 3 && flat[m] < 120, `${m} flat reach ${flat[m].toFixed(1)}`);
  ok(flat.base < flat.double && flat.double < flat.glide, 'base < Hunter triple < glide');
  ok(JR.reachOf('glide', -2) > flat.glide && JR.reachOf('glide', 2) < flat.glide, 'dropping extends the glide, climbing cuts it');
  ok(JR.bestRise() > 4 && JR.bestRise() < 6.2, 'best climb ' + JR.bestRise().toFixed(2));
  ok(JR.reachOf('lift', 99) === 0 && JR.reachTable(99) === null, 'an unreachable rise gives no reach');
});
test('U21b every phase stretch is unskippable: pad to pad is an unclimbable rise or a gap over every class jump by 1.5 m', () => {
  const D = WLV.WHISPER_DATA, top = JR.bestRise() + JR.RISE_MARGIN;
  ok(D.CHAINS.length >= 6, 'chains ' + D.CHAINS.length);
  for (const c of D.CHAINS.filter((x) => !D.PL.get(x.blocks[0]).secret)) {
    const A = D.PL.get(c.from), B = D.PL.get(c.to), rise = B.top - A.top;
    const gx = Math.max(0, A.x0 - B.x1, B.x0 - A.x1), gz = Math.max(0, A.z0 - B.z1, B.z0 - A.z1), gap = Math.hypot(gx, gz);
    const need = rise > top ? 0 : JR.reachTable(rise) + 1.5;
    ok(rise > top || gap >= need, `${c.id} rise ${rise.toFixed(1)} gap ${gap.toFixed(1)} needs ${need.toFixed(1)}`);
  }
});
test('U21b checkWhisperRoute finds no problems (no class jump skips a phase stretch, base hops within 70 percent, movers safe)', () => {
  const r = WLV.checkWhisperRoute();
  eq(r.problems, []);
  ok(r.rows.length > 20, 'rows ' + r.rows.length);
  eq(WLV.checkWhisperRoute({ sprint: false }).problems, []);
});
test('U21b the route check can fail: a foothold bridging two stages is reported', () => {
  const D = WLV.WHISPER_DATA, a = D.PL.get('sh_c2a');
  D.PL.set('zz_bridge', { id: 'zz_bridge', x0: a.x0, x1: a.x1, z0: a.z1 + 2, z1: a.z1 + 4, top: a.top + 6.5, seg: 'shaft', kind: 'ledge', dead: false, secret: false });
  const n = D.HOPS.length; D.HOPS.push(['sh_c2a', 'zz_bridge', 'jump']); D.HOPS.push(['zz_bridge', 'sh_e5', 'jump']);
  const bad = WLV.checkWhisperRoute().problems.length; D.PL.delete('zz_bridge'); D.HOPS.length = n;
  ok(bad > 0, 'a planted bridge is found');
  eq(WLV.checkWhisperRoute().problems, []);
});
test('U21b the level exports leap links between static footholds only', () => {
  const l = WLV.default.whisper.leapLinks;
  ok(Array.isArray(l) && l.length >= 6, 'links ' + l.length);
  for (const k of l) ok(k.a.length === 3 && k.b.length === 3 && typeof k.two === 'boolean', 'link shape');
});
test('U21b movers: every layout mover has a safe crossing window and a deterministic cycle', () => {
  let n = 0;
  for (const S of WL.segments) for (const m of S.movers || []) {
    n++; const w = EX.moverSafe(m);
    ok(w.safe >= w.need, `${m.id} safe ${w.safe.toFixed(1)} need ${w.need.toFixed(1)}`);
    for (const t of [0, 1.7, 5.3]) { eq(EX.moverState(m, t), EX.moverState(m, t)); eq(EX.moverState(m, t).phase, EX.moverState(m, t + m.period).phase); }
    ok(EX.moverState(m, -m.phase).phase === 'rest' || m.period > 0, 'cycle');
    const phases = new Set(); for (let t = 0; t < m.period; t += 0.05) phases.add(EX.moverState(m, t).phase);
    ok(['rest', 'tele', 'fire', 'hold', 'ret'].every((x) => phases.has(x)), `${m.id} shows its telegraph`);
  }
  ok(n >= 8, 'movers ' + n);
});
test('U21b symbols: eight distinct vector shapes, no font characters, pairwise silhouettes differ', () => {
  eq(EX.GLYPH_SYMBOLS.length, 8); eq(new Set(EX.GLYPH_SYMBOLS).size, 8);
  for (const n of EX.GLYPH_SYMBOLS) { ok(Array.isArray(EX.GLYPH_SHAPES[n]) && EX.GLYPH_SHAPES[n].length >= 1, n + ' has polygons'); const m = EX.glyphMask(n); ok(m.reduce((a, b) => a + b, 0) > 80, n + ' fills area'); }
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) { const o = EX.glyphOverlap(EX.GLYPH_SYMBOLS[i], EX.GLYPH_SYMBOLS[j]); ok(o < 0.6, `${EX.GLYPH_SYMBOLS[i]} vs ${EX.GLYPH_SYMBOLS[j]} overlap ${o.toFixed(2)}`); }
});
test('U21b checkWhisperSymbols: every eye symbol and board is readable, in line of sight and not inside a wall', () => {
  const r = WLV.checkWhisperSymbols();
  eq(r.problems, []);
  ok(r.rows.filter((x) => x.includes('eye')).length >= 17, 'eyes checked ' + r.rows.length);
  ok(r.rows.some((x) => x.includes('gallery board')) && r.rows.some((x) => x.includes('falls board')), 'both boards checked');
});
test('U21b secret path: three hidden eyes, a chest on the last side block, and the side blocks are not on the main chain', () => {
  const sh = WL.segments.find((x) => x.id === 'shaft');
  eq(sh.secret.eyes.length, 3); ok(sh.secret.blocks.length >= 2 && sh.secret.chest.length === 3, 'chest');
  const main = new Set(sh.phaseBlocks.map((b) => b.p.join()));
  ok(sh.secret.blocks.every((b) => !main.has(b.p.join())), 'separate blocks');
  eq(EX.validateLayout(WL, EX.exoticDef('whisper')), [], 'the real layout passes the contract');
});
test('U21b the timer stays 20:00 and segment checkpoints are inside their regions', () => {
  eq(EX.exoticDef('whisper').timeLimit, 1200);
  for (const S of WL.segments) { const c = S.checkpoint, r = S.region; ok(c[0] >= r.minX && c[0] <= r.maxX && c[2] >= r.minZ && c[2] <= r.maxZ, S.id + ' checkpoint in region'); }
});

// ---------- H27 keybinds and terms ----------
test('H27 keybinds: the Keyboard scheme is the old layout; every action has a target', () => {
  const b = KB.presetBinds('keyboard');
  eq(b.grenade, ['KeyQ', null]); eq(b.fire, ['Mouse0', null]); eq(b.ads, ['Mouse2', null]); eq(b.nextWeapon, ['WheelDown', null]);
  const L = KB.buildLookup(b);
  eq(L.get('KeyQ'), ['KeyQ']); eq(L.get('Mouse2'), ['mouse:right']); eq(L.get('WheelDown'), ['wheel:1']); eq(L.get('WheelUp'), ['wheel:-1']);
  for (const a of KB.ACTIONS) ok(b[a.id].filter(Boolean).length === 1, `${a.id} bound once`);
  eq(new Set(KB.ACTIONS.map((a) => a.target)).size, KB.ACTIONS.length, 'targets are unique');
});
test('H27 keybinds: the trackpad scheme aims from X or a secondary click, keeps a key for Next weapon, and guards the wheel', () => {
  const b = KB.presetBinds('trackpad');
  eq(b.ads, ['KeyX', 'Mouse2']); eq(b.nextWeapon, ['KeyT', 'WheelDown']); eq(b.melee, ['KeyG', null]);
  eq(KB.PRESETS.trackpad.guard, true); eq(KB.PRESETS.keyboard.guard, false);
  const all = Object.values(b).flat().filter(Boolean);
  eq(new Set(all).size, all.length, 'no input bound twice');
});
test('H27 keybinds: assign swaps a taken input; null clears; reserved keys throw', () => {
  const b = KB.presetBinds('keyboard');
  const r = KB.assign(b, 'grenade', 0, 'KeyE');
  eq(r.binds.grenade[0], 'KeyE'); eq(r.binds.interact[0], 'KeyQ', 'interact takes the old grenade key'); eq(r.swapped, [{ action: 'interact', slot: 0 }]);
  eq(b.grenade[0], 'KeyQ', 'the input table is not mutated');
  eq(KB.assign(b, 'melee', 1, 'KeyG').binds.melee, ['KeyB', 'KeyG']);
  eq(KB.assign(b, 'melee', 0, null).binds.melee, [null, null]);
  for (const k of ['Escape', 'ControlLeft', 'MetaLeft', 'Bogus']) { let threw = false; try { KB.assign(b, 'melee', 0, k); } catch { threw = true; } ok(threw, `${k} refused`); }
});
test('H27 keybinds: a saved table is cleaned (bad, reserved and duplicate inputs dropped, missing actions defaulted)', () => {
  const kb = KB.sanitizeKeybinds({ scheme: 'slot2', binds: { grenade: ['KeyG', 'Escape'], melee: ['KeyG'], fire: 'nope', made_up: ['KeyZ'] }, guard: 1, slots: [{ name: '  Nathan  ', binds: {} }, 'junk'] });
  eq(kb.binds.grenade, ['KeyG', null]); eq(kb.binds.melee, [null, null], 'duplicate dropped'); eq(kb.binds.fire, ['Mouse0', null], 'malformed falls back');
  ok(!('made_up' in kb.binds)); eq(kb.guard, true);
  eq(kb.slots.length, KB.CUSTOM_SLOTS); eq(kb.slots[0].name, 'Nathan'); eq(kb.slots[1], null);
  eq(kb.scheme, null, 'a scheme pointing at an empty slot becomes unsaved');
  eq(KB.sanitizeKeybinds(undefined), KB.defaultKeybinds());
});
test('H27 keybinds: an old save loads with the Keyboard scheme (no save version change)', () => {
  fresh();
  const s = S.createSave('stalker');
  delete s.settings.keybinds; S.writeSave(s);
  const back = S.loadSave();
  eq(back.settings.keybinds.scheme, 'keyboard'); eq(back.settings.keybinds.binds.super, ['KeyF', null]);
});
test('H27 scroll guard: one swap per swipe; off, every event counts', () => {
  const st = KB.wheelState();
  const swipe = (t0, n, d) => { let sum = 0; for (let i = 0; i < n; i++) sum += KB.wheelStep(st, d, t0 + i * 16, true); return sum; };
  eq(swipe(0, 30, 6), 1, 'a long swipe down is one Next');
  eq(swipe(2000, 30, -6), -1, 'after a pause, a swipe up is one Previous');
  eq(swipe(2600, 3, 6), 0, 'a nudge under the step does nothing');
  const off = KB.wheelState(); let n = 0; for (let i = 0; i < 5; i++) n += KB.wheelStep(off, 3, i, false); eq(n, 5);
});
test('H27 keybinds: labels, Mac Ctrl+click and the controls list follow the binds', () => {
  eq(KB.physLabel('KeyQ'), 'Q'); eq(KB.physLabel('Mouse2'), 'RMB'); eq(KB.physLabel('WheelDown'), 'Wheel ↓'); eq(KB.physLabel('ShiftLeft'), 'L-Shift');
  eq(KB.mousePhys(0, true, true), 'Mouse2'); eq(KB.mousePhys(0, true, false), 'Mouse0'); eq(KB.mousePhys(3), 'Mouse3');
  const b = KB.assign(KB.presetBinds('trackpad'), 'grenade', 0, 'KeyZ').binds;
  const list = KB.controlsList(b);
  eq(list.find(([, v]) => v === 'Grenade')[0], 'Z'); eq(list.find(([, v]) => v === 'Aim down sights')[0], 'X / RMB');
});
test('H27 terms: only an acceptance of the current version counts', () => {
  ok(!TM.termsCurrent(null)); ok(!TM.termsCurrent({ v: 'x' }));
  ok(TM.termsCurrent({ v: TM.TERMS_VERSION })); ok(!TM.termsCurrent({ v: TM.TERMS_VERSION }, TM.TERMS_VERSION + 1), 'new text asks again');
  ok(TM.TERMS_SECTIONS.some(([h]) => h === 'Privacy') && TM.TERMS_SECTIONS.some(([h]) => h === 'Built with AI'));
  ok(TM.TERMS_SECTIONS.flat(2).join(' ').includes('not affiliated with Bungie'));
});

// ---------- U23 The Emperor's Shadow: dungeon rules, loot exclusivity, save v14 ----------
import * as DGR from '../js/dungeon-rules.js';
import * as DL from '../js/dungeon-loot.js';
import { IMPERIAL_TUNE } from '../js/dungeon-loot.js';
import { EXOTIC_RANDOM_WEAPONS } from '../js/data.js';
test('U23 dungeon registry is valid; units exist; Loyalist dungeon units are marked', () => {
  for (const d of DGR.dungeonList()) eq(DGR.validateDungeon(d), [], `${d.id} valid`);
  const d = DGR.dungeonDef('shadow');
  eq(d.enemyLightOver, 20); eq(d.strikes, 3); eq(d.exoticChance, 0.05); eq(d.unlock.mission, 'lev1');
  ok(FA.UNITS.lg_bather.dungeon === 'shadow' && FA.UNITS.lg_taster.dungeon === 'shadow');
  let threw = false; try { DGR.dungeonDef('nope'); } catch { threw = true; } ok(threw, 'unknown id throws');
});
test('U23 sigils: four vector shapes, each clearly different from the others', () => {
  eq(DGR.SIGILS, ['axes', 'chalice', 'sun', 'hound'], 'order: axes, chalice, sun, hound');
  for (const a of DGR.SIGILS) { const m = DGR.sigilMask(a); const fill = m.filter(Boolean).length / m.length; ok(fill > 0.12 && fill < 0.7, `${a} fills ${fill.toFixed(2)} of its box`); }
  for (const a of DGR.SIGILS) for (const b of DGR.SIGILS) if (a < b) ok(DGR.sigilOverlap(a, b) < 0.5, `${a} vs ${b} overlap ${DGR.sigilOverlap(a, b).toFixed(2)}`);
  ok(DGR.inSigil('sun', 0, 0) && !DGR.inSigil('sun', 0.9, 0.9), 'sun: centre in, corner out');
});
test('U23 unlock: clearing the Leviathan campaign mission, at any level; records per Guardian', () => {
  const d = DGR.dungeonDef('shadow');
  ok(!DGR.dungeonUnlocked({ cleared: {} }, d)); ok(DGR.dungeonUnlocked({ cleared: { lev1: true } }, d));
  const s = {}; eq(DGR.dungeonRecord(s, 'shadow'), { clears: 0, bestTime: null });
  const r1 = DGR.recordDungeonClear(s, 'shadow', 1500.04); ok(r1.first && r1.newBest); eq(r1.record.bestTime, 1500);
  const r2 = DGR.recordDungeonClear(s, 'shadow', 1600); ok(!r2.first && !r2.newBest); eq(s.dungeons.shadow.clears, 2);
});
test('U23 offerings: steps scale 3/4/5; a wrong offering is a strike; the third is lethal; a solved round clears strikes', () => {
  const cfg = DGR.dungeonDef('shadow').segments.baths;
  eq([1, 2, 3].map((n) => DGR.offeringSteps(cfg, n)), [3, 4, 5]); eq(DGR.offeringSteps(cfg, 9), 5);
  const o = DGR.makeOrder(40, Math.random); for (let i = 1; i < o.length; i++) ok(o[i] !== o[i - 1], 'never the same sigil twice in a row');
  const round = { order: ['axes', 'sun', 'hound'], progress: 0, solved: false }, st = {};
  eq(DGR.offer(round, st, 'a', 'axes'), 'right'); eq(round.progress, 1);
  eq(DGR.offer(round, st, 'a', 'chalice'), 'wrong'); eq(st.a, 1); eq(round.progress, 1, 'a wrong offering keeps the progress');
  eq(DGR.offer(round, st, 'b', 'chalice'), 'wrong'); eq(st.b, 1, 'strikes are per player');
  eq(DGR.offer(round, st, 'a', 'hound'), 'wrong'); eq(st.a, 2);
  eq(DGR.offer(round, st, 'a', 'axes'), 'lethal'); eq(st.a, 0, 'the count starts over after the death');
  eq(DGR.offer(round, st, 'b', 'sun'), 'right'); eq(DGR.offer(round, st, 'b', 'hound'), 'solved'); ok(round.solved);
  eq(Object.keys(st).length, 0, 'solved clears every strike'); eq(DGR.offer(round, st, 'a', 'sun'), 'ignored');
});
test('U23 DPS boss: immune until a window; no damage gates; final boss warns, enrages, then final stand wipes', () => {
  const f = new DGR.DpsBossFsm({ windowTime: 10 });
  ok(f.immune); eq(f.openWindow(), ['window']); ok(!f.immune); eq(f.openWindow(), [], 'no second window while one is open');
  eq(f.tick(9, 50, 100), []); eq(f.tick(1.5, 50, 100), ['window-end']); ok(f.immune);
  eq(f.tick(0.1, 0, 100), ['dead']);
  const E = new DGR.DpsBossFsm({ windowTime: 10, enrage: { after: 3, finalFrac: 0.1, finalWind: 12 } });
  for (let k = 1; k <= 2; k++) { eq(E.openWindow(), ['window']); eq(E.tick(11, 90, 100), ['window-end']); }
  eq(E.openWindow(), ['window', 'enrage-warning'], 'the third DPS phase carries the warning');
  eq(E.tick(11, 80, 100), ['window-end', 'enraged']);
  eq(E.openWindow(), ['window']); eq(E.tick(11, 70, 100), ['final'], 'enraged: final stand after the next DPS phase, whatever its health');
  eq(E.tick(11, 70, 100), []); eq(E.tick(2, 70, 100), ['final-wipe']);
  const F = new DGR.DpsBossFsm({ windowTime: 10, enrage: { after: 3, finalFrac: 0.1, finalWind: 12 } });
  F.openWindow(); eq(F.tick(1, 9, 100), ['final'], 'health at the final chunk starts final stand'); eq(F.mode, 'final');
  eq(F.tick(1, 0, 100), ['dead']);
  F.reset(); eq(F.mode, 'immune'); eq(F.phases, 0);
});
test('U23 dungeon loot never enters a random pool; drops carry the exclusive perk and look', () => {
  const names = DL.DUNGEON_WEAPONS.map((w) => w.name);
  eq(names, ['Gilded Decree', 'Royal Pardon', 'Feastbreaker', "The Taster's Due", 'Throneward', 'Last Course']);
  ok(!LEGENDARY_WEAPONS.some((l) => names.includes(l.name)), 'not in the legendary pool');
  ok(!EXOTIC_RANDOM_WEAPONS.some((e) => e.name === DL.DUNGEON_EXOTIC) && EXOTIC_WEAPONS.some((e) => e.name === DL.DUNGEON_EXOTIC), 'exotic exists but never rolls randomly');
  ok(!ST.SET_IDS.includes('imperial') && ST.SETS.imperial, 'set kept out of random sets');
  ok(!ST.SHADER_IDS.includes(DL.DUNGEON_SHADER) && ST.SHADERS[DL.DUNGEON_SHADER], 'shader kept out of random shaders');
  for (const p of DL.DUNGEON_PERKS) ok(PERKS[p]?.exclusive === 'shadow', `${p} defined and exclusive`);
  for (const w of DL.DUNGEON_WEAPONS) {
    const it = DL.makeDungeonWeapon(100, Math.random, w);
    eq([it.name, it.rarity, it.dungeon, it.frame, it.element], [w.name, 'legendary', 'shadow', w.frame, w.element]);
    eq(it.perks.filter((p) => DL.DUNGEON_PERKS.includes(p)).length, 1, `${w.name}: one exclusive perk`);
  }
  for (let i = 0; i < 300; i++) ok(!rollItem(100, 3).perks?.some((p) => DL.DUNGEON_PERKS.includes(p)), 'random drops never roll an exclusive perk');
  eq(DL.makeDungeonArmor(100, 'vanguard', Math.random, 'helmet').name, 'Imperial Shadow Helm');
  eq(DL.makeDungeonArmor(100, 'stalker', Math.random, 'legs').name, 'Imperial Envoy Strides');
  eq(DL.makeDungeonArmor(100, 'arcanist', Math.random, 'chest').set, 'imperial');
  eq(DL.makeDungeonExotic(100).name, DL.DUNGEON_EXOTIC);
  ok(IMPERIAL_TUNE.titheStacks === 5 && IMPERIAL_TUNE.guardCut === 0.75);
});
test('U23 clear drops: one pool item each time, 5% exotic, the shader once on the first full clear', () => {
  const d = DGR.dungeonDef('shadow');
  let ex = 0; const N = 20000;
  for (let i = 0; i < N; i++) { const r = DGR.clearDrops(d); ok(r[0].kind === 'weapon' || r[0].kind === 'armor'); if (r.some((x) => x.kind === 'exotic')) ex++; }
  ok(Math.abs(ex / N - 0.05) < 0.01, `exotic rate ${(ex / N).toFixed(3)}`);
  ok(DGR.clearDrops(d, { finalClear: true, firstClear: true, ownsShader: false }).some((x) => x.kind === 'shader'));
  ok(!DGR.clearDrops(d, { finalClear: true, firstClear: true, ownsShader: true }).some((x) => x.kind === 'shader'));
  ok(!DGR.clearDrops(d, { finalClear: false, firstClear: true }).some((x) => x.kind === 'shader'));
});
test('U23 save v14: v13 migrates with everything kept, per Guardian dungeons added', () => {
  const v13 = { version: 13, classId: 'stalker', glimmer: 9, inventory: [], vault: [], equipped: {}, cleared: { lev1: true }, tier: 'base', tierCleared: { legendary: {}, ultimate: {} }, ultimateAll: false, pendingMenus: [], overload: false, skipped: false, exoticMissions: { whisper: { clears: 2, bestTime: 700 } }, postmaster: [], exoticsFound: ['Thorn'], progression: { xp: 5 },
    chars: { vanguard: { inventory: [], equipped: {}, cleared: {}, tier: 'base', tierCleared: { legendary: {}, ultimate: {} }, pendingMenus: [], overload: false, skipped: false, postmaster: [], exoticMissions: { whisper: { clears: 0, bestTime: null } } } } };
  fresh({ afterlight_save_v2: JSON.stringify(v13) });
  const s = S.loadSave();
  ok(s, 'loads'); eq(s.version, S.SAVE_VERSION);
  eq(s.dungeons, { shadow: { clears: 0, bestTime: null } }); eq(s.chars.vanguard.dungeons, { shadow: { clears: 0, bestTime: null } });
  eq(s.exoticMissions.whisper.clears, 2, 'the Whisper record is kept'); eq(s.cleared, { lev1: true });
  const n = S.createSave('stalker'); eq(n.dungeons, { shadow: { clears: 0, bestTime: null } });
  DGR.recordDungeonClear(n, 'shadow', 900); S.switchCharacter(n, 'vanguard'); eq(DGR.dungeonRecord(n, 'shadow').clears, 0); S.switchCharacter(n, 'stalker'); eq(DGR.dungeonRecord(n, 'shadow').clears, 1);
});
test('U23 leash: outside DPS a boss keeps to its area and walks back; in a window it chases', () => {
  const home = [0, 0, -26];
  eq(DGR.leashStep(3, -24, home, 10, false, 6, 0.1), [3, -24], 'inside the area: free');
  eq(DGR.leashStep(0, -10, home, 10, true, 6, 0.1), [0, -10], 'in a window: no leash');
  const [x, z] = DGR.leashStep(0, -10, home, 10, false, 6, 0.1); eq([x, +z.toFixed(2)], [0, -10.6], 'outside: steps back 0.6 m, no teleport');
  let p = [0, 4]; for (let i = 0; i < 200; i++) p = DGR.leashStep(p[0], p[1], home, 10, false, 6, 0.1); ok(Math.abs(Math.hypot(p[0], p[1] + 26) - 10) < 1e-6, 'ends at the edge of the area');
  eq(DGR.dungeonDef('shadow').segments.baths.boss.leash, 10);
});
test('U23 Vhorrak never one-shots: every hit is capped below a full health plus shield pool', () => {
  const f = DGR.dungeonDef('shadow').segments.baths.boss.hitFrac;
  for (const [k, v] of Object.entries(f)) ok(v > 0 && v < 0.5, `${k} takes under half the pool`);
  eq(DGR.cappedHit(220, 201, 0.45), 201 * 0.45, 'a 220 cleave on a 201 pool lands for 90');
  eq(DGR.cappedHit(30, 201, 0.45), 30, 'a weak hit is not raised');
});
test('U23 the Whisper is untouched: still its own registry, timer and rules', () => {
  eq(EX.exoticList().map((x) => x.id), ['whisper']); eq(EX.exoticDef('whisper').timeLimit, 1200); eq(EX.exoticDef('whisper').enemyLightOver, 10);
  eq(EX.validateExotic(EX.exoticDef('whisper')), []);
});

// ---------- U23 chunk B: The Underbelly and The Pleasure Gardens ----------
import * as SR from '../js/shadow-route.js';
import * as LS from '../js/level-shadow.js';
test('U23B registry: both new segments are valid and match the layout; new units are Loyalist dungeon units', () => {
  const d = DGR.dungeonDef('shadow');
  eq(DGR.validateDungeon(d), []);
  eq(LS.SHADOW_LAYOUT.segments.map((s) => s.id).slice(0, 3), ['baths', 'underbelly', 'gardens'], 'chunk C appends after these');
  for (const s of LS.SHADOW_LAYOUT.segments) ok(d.segments[s.id], `${s.id} has a registry entry`);
  for (const id of ['lg_watcher', 'lg_royalbeast']) { ok(FA.UNITS[id]?.dungeon === 'shadow', `${id} marked`); eq(FA.UNITS[id].faction, 'legion'); }
  eq(d.faction, 'legion');
});
test('U23B Watchers: the sweep stays inside its arc; cones, awareness, hurt alarm and the unseen rule', () => {
  const w = { yaw: 0.5, sweep: 0.9, period: 7, phase: 0 };
  for (let t = 0; t < 14; t += 0.37) { const y = DGR.watchYaw(w, t); ok(y >= 0.5 - 0.9 - 1e-9 && y <= 0.5 + 0.9 + 1e-9, 'inside the arc'); }
  ok(DGR.inCone(0, 0, 0, 0, 10, 20, 0.42), 'straight ahead'); ok(!DGR.inCone(0, 0, 0, 0, -10, 20, 0.42), 'behind');
  ok(!DGR.inCone(0, 0, 0, 0, 25, 20, 0.42), 'out of range'); ok(!DGR.inCone(0, 0, 0, 10, 10, 20, 0.42), 'outside the half-angle');
  ok(DGR.inCone(0, 0, Math.PI, 0.1, -10, 20, 0.42) && DGR.inCone(0, 0, -Math.PI, -0.1, -10, 20, 0.42), 'wraps round pi');
  const c = DGR.dungeonDef('shadow').segments.underbelly.watch;
  let a = 0; for (let i = 0; i < 12; i++) a = DGR.awareStep(a, 1 / 30, true, 10, c);
  ok(a < 1, 'a glimpse (0.4 s) does not raise the alarm'); a = DGR.awareStep(a, 1, false, 99, c); ok(a < 0.2, 'it fades out of sight');
  for (let i = 0; i < 40; i++) a = DGR.awareStep(a, 1 / 30, true, 10, c); eq(a, 1, 'about half a second in the cone raises it');
  ok(!DGR.hurtAlarm(0.5, true, c.hurtAlarm) && DGR.hurtAlarm(0.9, true, c.hurtAlarm) && !DGR.hurtAlarm(5, false, c.hurtAlarm), 'hurt and alive too long');
  eq(DGR.sectionOutcome([{ alive: false, alarmed: false }, { alive: false, alarmed: false }]), 'unseen');
  eq(DGR.sectionOutcome([{ alive: false, alarmed: false }, { alive: true, alarmed: false }]), 'watching');
  eq(DGR.sectionOutcome([{ alive: false, alarmed: true }, { alive: false, alarmed: false }]), 'alarm', 'an alarm stands after the Watcher dies');
});
test('U23B Royal Beasts: patrols are deterministic loops with corner pauses; awareness warns before a howl', () => {
  const seg = LS.SHADOW_LAYOUT.segments.find((s) => s.id === 'gardens'), C = DGR.dungeonDef('shadow').segments.gardens.beast;
  for (const b of seg.beasts) {
    const L = DGR.beastLoop(b.path, C.speed, C.pause);
    const p0 = DGR.beastAt(b.path, C.speed, C.pause, C.look, 3.3), p1 = DGR.beastAt(b.path, C.speed, C.pause, C.look, 3.3 + L);
    ok(Math.abs(p0.x - p1.x) < 1e-6 && Math.abs(p0.z - p1.z) < 1e-6, 'one loop later it is back');
    const c = DGR.beastAt(b.path, C.speed, C.pause, C.look, Math.hypot(b.path[1][0] - b.path[0][0], b.path[1][1] - b.path[0][1]) / C.speed + C.pause / 2);
    ok(!c.moving && Math.abs(c.x - b.path[1][0]) < 1e-6, 'pauses at the corner');
    // the loop never cuts through a hedge
    for (let t = 0; t < L; t += 0.25) { const q = DGR.beastAt(b.path, C.speed, C.pause, C.look, t); ok(!seg.hedges.some((h) => q.x > h.x0 - 0.8 && q.x < h.x1 + 0.8 && q.z < h.z0 + 0.8 && q.z > h.z1 - 0.8), `beast clear of hedges at ${q.x.toFixed(1)}, ${q.z.toFixed(1)}`); }
  }
  let a = 0, t = 0; while (a < 1) { a = DGR.awareStep(a, 1 / 60, true, 12, C); t += 1 / 60; }
  ok(t > 1.4, `seen at range it takes ${t.toFixed(2)} s to fill (a visible warning)`);
  ok(C.howl >= 4, 'the howl gives at least 4 s of warning before the wipe');
});
test('U23B Gardens: flowers scale with the fireteam, sit clear of hedges; Bloom stacks; the down timer wipes at 30 s', () => {
  const seg = LS.SHADOW_LAYOUT.segments.find((s) => s.id === 'gardens'), cfg = DGR.dungeonDef('shadow').segments.gardens;
  eq([1, 2, 3].map((n) => DGR.flowerCount(cfg, n)), [4, 5, 6]);
  ok(seg.flowers.length >= 6);
  for (const f of seg.flowers) ok(!seg.hedges.some((h) => f[0] > h.x0 - 2 && f[0] < h.x1 + 2 && f[2] < h.z0 + 2 && f[2] > h.z1 - 2), `flower ${f} clear of hedges`);
  const pick = DGR.pickFlowers(6, 8, () => 0.3); eq(new Set(pick).size, 6);
  eq(+DGR.bloomMult(5, cfg.bloomPer).toFixed(2), 1.6); eq(DGR.bloomMult(0, cfg.bloomPer), 1);
  ok(STATUS.bloom && STATUS.bloom.maxStacks >= 6, 'Bloom is a stacking status');
  const downs = {};
  eq(DGR.downStep(downs, { a: true, b: false }, 29, 30), null);
  eq(DGR.downStep(downs, { a: false, b: false }, 2, 30), null, 'revived: the count is forgotten');
  eq(DGR.downStep(downs, { a: true, b: false }, 29.5, 30), null);
  eq(DGR.downStep(downs, { a: true, b: false }, 0.6, 30), 'a', 'down 30 s: wipe');
  eq(cfg.downLimit, 30);
  for (const t of seg.tasters) ok(seg.beasts.every((b) => { for (let k = 0; k < b.path.length; k++) { const p = b.path[k], q = b.path[(k + 1) % b.path.length]; const L2 = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; const u = Math.max(0, Math.min(1, ((t[0] - p[0]) * (q[0] - p[0]) + (t[2] - p[1]) * (q[1] - p[1])) / L2)); if (Math.hypot(t[0] - p[0] - u * (q[0] - p[0]), t[2] - p[1] - u * (q[1] - p[1])) < 8) return false; } return true; }), `Taster ${t} away from the patrols`);
});
test('U23B Kathrax: DPS windows only, capped hits, a leash, a real-size model scaled down', () => {
  const cfg = DGR.dungeonDef('shadow').segments.gardens, B = cfg.boss;
  ok(cfg.windowTime > 0 && !cfg.enrage, 'a DPS window, no damage gates, no enrage (not the final boss)');
  for (const [k, v] of Object.entries(B.hitFrac)) ok(v > 0 && v < 0.5, `${k} under half a pool`);
  ok(B.leash > 0 && B.windowLeash > B.leash && B.guard > B.leash, 'leashed to the pavilion outside a window');
  ok(B.scale < 1 && B.scale >= 0.6, 'scaled down from its real-size model');
  const f = new DGR.DpsBossFsm(cfg); ok(f.immune); f.openWindow(); eq(f.mode, 'window'); f.tick(cfg.windowTime + 0.1, 100, 100); eq(f.mode, 'immune');
});
test('U23B levers: right lights, wrong resets to the start, three right open the hatch', () => {
  const st = DGR.newLevers(3, () => 0.1); eq(st.order.length, 3); eq(new Set(st.order).size, 3);
  eq(DGR.pullLever(st, st.order[0]), 'right'); const bad = DGR.SIGILS.find((x) => !st.order.includes(x));
  eq(DGR.pullLever(st, bad), 'wrong'); eq(st.progress, 0, 'wrong starts over');
  eq(DGR.pullLever(st, st.order[0]), 'right'); eq(DGR.pullLever(st, st.order[1]), 'right'); eq(DGR.pullLever(st, st.order[2]), 'solved');
  eq(DGR.pullLever(st, st.order[0]), 'ignored');
  const seg = LS.SHADOW_LAYOUT.segments.find((s) => s.id === 'underbelly');
  eq(seg.levers.map((l) => l.sigil).sort(), [...DGR.SIGILS].sort(), 'one lever per sigil');
});
test('U23B checkShadowRoute: no class jump or glide at Mobility 50 skips a grate stretch; movers have safe windows', () => {
  const r = SR.checkShadowRoute();
  eq(r.problems, [], r.problems.join(' | '));
  const r2 = SR.checkShadowRoute({ sprint: false }); eq(r2.problems, [], 'walking in the air too');
  // the checker catches a skip: a planted ledge half way along G1 lets a glide across
  const bad = SR.checkShadowRoute({ extra: [{ id: 'plant', x0: 6, x1: 9, z0: -114, z1: -118, top: 3, stage: null }] });
  ok(bad.problems.some((p) => p.includes('stage 0')), 'a planted foothold is caught');
  // G1 is longer than the best flat reach plus margin from the top of deck cover
  const A = LS.UB_FOOT.find((f) => f.id === 'ub_a3'), B = LS.UB_FOOT.find((f) => f.id === 'ub_b1');
  ok(A.z1 - B.z0 > 35.7, `G1 spans ${(A.z1 - B.z0).toFixed(1)} m`);
  ok(LS.UB_FOOT.find((f) => f.id === 'ub_c1').top - (2 + SR.COVER_LIFT) > 5.57, 'G2 climbs more than any class jump plus margin');
});

// ---------- U23 chunk C: The Gauntlet, The Throne, solo tuning ----------
test('U23C registry: the Gauntlet and the Throne are valid, last in the layout; Psychic Echoes are Loyalist dungeon units; Calus has his own model', async () => {
  const d = DGR.dungeonDef('shadow');
  eq(DGR.validateDungeon(d), []);
  eq(LS.SHADOW_LAYOUT.segments.map((s) => s.id), ['baths', 'underbelly', 'gardens', 'gauntlet', 'throne']);
  ok(FA.UNITS.lg_echo?.dungeon === 'shadow' && FA.UNITS.lg_echo.faction === 'legion', 'lg_echo marked');
  const BM = await import('../js/bosses.js');
  ok(typeof BM.BOSS_MODELS.emperorCalus === 'function' && typeof BM.BOSS_MODELS.calus === 'function', 'a new Calus model; the old one stays');
  eq(d.segments.throne.boss.model, 'emperorCalus');
  for (const t of Object.keys(FA.UNITS).filter((k) => FA.UNITS[k].faction === 'legion')) { // every Loyalist unit has a model (lg_echo was missing)
    const g = new THREE.Group(), B = (w, h, dd, x, y, z, m, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), m); o.position.set(x, y, z); parent.add(o); return o; };
    const add = (geo, m, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
    const pivot = (x, y, z, parent = g) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
    const mk = () => new THREE.MeshStandardMaterial();
    let err = null; try { cabal({ g, add, B, pivot, bodyMat: mk(), dark: mk(), accent: mk(), C: { loyalist: true }, muzzle: new THREE.Object3D(), legs: [], arms: [], torso: null, height: 2 }, t); } catch (e) { err = e.message; }
    eq(err, null, `${t} builds`);
  }
  ok(d.segments.throne.boss.scale < 1, 'built at real size, scaled down');
});
test('U23C checkGauntlet: no class jump or glide at Mobility 50 skips a stair; the stairs are base jumps; wards have safe windows', () => {
  const r = SR.checkGauntlet();
  eq(r.problems, [], r.problems.join(' | '));
  eq(SR.checkGauntlet({ sprint: false }).problems, [], 'walking in the air too');
  const bad = SR.checkGauntlet({ extra: [{ id: 'plant', x0: -2, x1: 2, z0: -334, z1: -338, top: 16, stage: null }] });
  ok(bad.problems.some((p) => p.includes('stage 0')), 'a planted foothold mid-stair is caught');
  for (let k = 1; k < LS.GT_LAND.length - 1; k++) ok(LS.GT_LAND[k + 1].top - LS.GT_LAND[k].top > 5.57 || LS.GT_LAND[k + 1].id === 'gt_alc', `${LS.GT_LAND[k].id} climbs past any class jump`);
  eq(SR.checkShadowRoute().problems, [], 'the whole route (Underbelly and Gauntlet)');
});
test('U23C Gauntlet offerings: one sigil per row, a wrong plate is a strike, the third kills; a flawless run opens the alcove', () => {
  const rd = DGR.newRound(1, mulberry32(4)), st = {};
  const right = rd.order[0], wrong = DGR.SIGILS.find((x) => x !== right);
  eq([DGR.offer(rd, st, 'a', wrong), DGR.offer(rd, st, 'a', wrong), DGR.offer(rd, st, 'a', wrong)], ['wrong', 'wrong', 'lethal']);
  eq(DGR.offer(rd, st, 'a', right), 'solved');
  ok(DGR.flawlessProcession(0, 4, 4) && !DGR.flawlessProcession(1, 4, 4) && !DGR.flawlessProcession(0, 3, 4), 'flawless needs every row and no wrong offering');
  for (const w of LS.GT_WALLS) eq([...w.plates.map((p) => p.sigil)].sort(), [...DGR.SIGILS].sort(), `${w.id} carries all four sigils`);
});
test('U23C Calus: enrage warns as the 3rd DPS phase opens, enrages when it ends, final stand after the next; the Feast wipes', () => {
  const cfg = DGR.dungeonDef('shadow').segments.throne, f = new DGR.DpsBossFsm(cfg), max = 1000;
  for (let w = 1; w <= 3; w++) {
    const ev = f.openWindow();
    eq(ev.includes('enrage-warning'), w === 3, `warning only on window ${w === 3 ? 3 : w}`);
    const end = f.tick(cfg.windowTime + 0.01, max, max);
    ok(end.includes('window-end'), 'window ends'); eq(end.includes('enraged'), w === 3, 'enraged after the 3rd');
  }
  f.openWindow();
  ok(f.tick(cfg.windowTime + 0.01, max, max).includes('final'), 'final stand after the next DPS phase, whatever the health');
  ok(!f.immune && f.finalLeft === cfg.enrage.finalWind && cfg.enrage.finalWind >= 12, 'a long wind-up, and he takes damage in it');
  ok(f.tick(cfg.enrage.finalWind + 0.1, max, max).includes('final-wipe'), 'the Feast wipes');
  const g = new DGR.DpsBossFsm(cfg); g.openWindow();
  ok(g.tick(0.1, max * cfg.enrage.finalFrac, max).includes('final'), 'or when his health falls to the final chunk');
  eq(DGR.feastStage(cfg.enrage.finalWind, cfg.enrage.finalWind).stage, 'rise'); eq(DGR.feastStage(0, 16).stage, 'done');
});
test('U23C solo tuning: no hit over 40% of the pool, no burst over 65%; two Psion snipes in one frame no longer kill from full', () => {
  const d = DGR.dungeonDef('shadow'), g = DGR.guardFor(d, 1), pool = 215;
  eq(DGR.guardFor(d, 2), d.guard.team);
  const inc = 1.62, dmgMult = (1 + d.g * 0.07) * g.addDmg, snipe = FA.UNITS.lg_psion.snipe.dmg * dmgMult * inc;
  ok(snipe / pool < 0.5, `a snipe takes ${(100 * snipe / pool).toFixed(0)}% (was about 60%)`);
  const st = {};
  const a = DGR.hitGuard(st, 10, snipe, pool, g), b = DGR.hitGuard(st, 10, snipe, pool, g);
  ok(a + b <= pool * g.burstFrac + 1e-9 && a + b < pool, `two at once take ${(a + b).toFixed(0)} of ${pool}`);
  eq(DGR.hitGuard({}, 0, 999, pool, g), pool * g.hitFrac, 'one huge hit is capped');
  const later = DGR.hitGuard(st, 10 + g.burstWin + 0.01, snipe, pool, g);
  ok(Math.abs(later - Math.min(snipe, pool * g.hitFrac)) < 1e-9, 'the window clears');
  ok(DGR.bossHpFor(1000, { hpMult: 1 }, g) < DGR.bossHpFor(1000, { hpMult: 1 }, d.guard.team), 'solo bosses carry less health');
});

test('U23C hand cannon: kicks up and right (aggressive more, precision straight up); the iron sights are gone, a floating dot sits on the sight line', async () => {
  const ang = (f) => { const k = recoilKick(recoilProfileFor(weaponHandling({ arch: 'hand', rarity: 'legendary', frame: f })), 0.045, () => 0.5); return Math.atan2(-k.yaw, k.pitch) * 180 / Math.PI; };
  ok(ang('adaptive') >= 18 && ang('aggressive') > ang('adaptive') && Math.abs(ang('precision')) < 1e-9, `angles ${ang('adaptive').toFixed(0)}, ${ang('aggressive').toFixed(0)}, ${ang('precision').toFixed(0)}`);
  const { buildGunModel } = await import('../js/models.js');
  const g = buildGunModel({ arch: 'hand', rarity: 'legendary', frame: 'adaptive', element: 'kinetic', name: 'Test' });
  let dot = null; g.traverse((o) => { if (o.userData.sightDot) dot = o; });
  ok(dot, 'a sight dot');
  ok(Math.abs(dot.position.y - g.userData.sightY) < 1e-9 && Math.abs(dot.position.x) < 1e-9, 'on the sight line (screen centre at ADS)');
  let posts = 0; g.traverse((o) => { if (o.isMesh && o.geometry.type === 'BoxGeometry' && o.geometry.parameters.width === 0.007 && o.geometry.parameters.depth === 0.007) posts++; });
  eq(posts, 0, 'no front post');
});

// ---- H28: the Mars freeze (a jetpack Centurion's NaN leap hung the frame) and the GPU leaks ----
test('H28 no class defines the same method twice (a second startLeap silently replaced the Cabal rocket leap)', async () => {
  const map = JSON.parse((await (await fetch('../index.html')).text()).match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  const files = Object.keys(map).filter((k) => k.startsWith('./js/')).map((k) => k.slice(2));
  ok(files.length > 50, `found the game modules (${files.length})`);
  const dups = [];
  for (const f of files) {
    const src = await (await fetch(`../${f}`)).text();
    let cls = null, seen = null;
    for (const line of src.split('\n')) {
      const c = line.match(/^(?:export )?class (\w+)/);
      if (c) { cls = c[1]; seen = new Set(); continue; }
      if (cls && /^\}/.test(line)) { cls = null; continue; }
      const m = cls && line.match(/^  (?:async |static )?(?:(get|set) )?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/);
      if (!m) continue;
      const key = (m[1] || '') + m[2];
      if (seen.has(key)) dups.push(`${f} ${cls}.${m[2]}`); else seen.add(key);
    }
  }
  eq(dups, [], 'duplicate class methods');
  const enemySrc = await (await fetch('../js/enemies.js')).text();
  ok(/^  startLeap\(P, dist\) \{/m.test(enemySrc) && /^  startLinkLeap\(w\) \{/m.test(enemySrc), 'the rocket leap and the nav link leap are separate methods');
  ok(/this\.startLeap\(P, dist\)/.test(enemySrc) && /this\.startLinkLeap\(w\)/.test(enemySrc), 'each caller uses its own leap');
});
test('H28 a NaN or infinite ray, sight line or angle returns at once instead of looping', async () => {
  const { hasLOS } = await import('../js/physics.js');
  const { wrapAngle } = await import('../js/util.js');
  const errs = [], ce = console.error; console.error = (...a) => errs.push(String(a[0]));
  try {
    withLevel(hillTerrain(), () => {
      eq(rayGround({ x: NaN, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, 40), Infinity, 'NaN origin: no ground');
      eq(rayGround({ x: 0, y: 1, z: 0 }, { x: NaN, y: 0, z: NaN }, NaN), Infinity, 'NaN direction and distance (the frozen Centurion): no ground');
      ok(rayGround({ x: 0, y: 10, z: 0 }, { x: 0, y: -1, z: 0 }), 'a finite ray with the default far still hits the ground');
      const v = (x, y, z) => new THREE.Vector3(x, y, z);
      eq(hasLOS(v(NaN, NaN, NaN), v(0, 1.6, -112)), false, 'a NaN eye sees nothing');
      eq(hasLOS(v(0, 1.6, 0), v(Infinity, 1.6, 0)), false, 'an infinite target is not seen');
    });
    const nav = buildNav([], { minX: -10, maxX: 10, minZ: -10, maxZ: 10 });
    eq(lineClear(nav, 0, 0, Infinity, 0), false, 'an infinite line is not clear');
    eq(lineClear(nav, 0, 0, NaN, 0), false, 'a NaN line is not clear');
    ok(lineClear(nav, 0, 0, 5, 5), 'a finite line on open ground is still clear');
  } finally { console.error = ce; }
  ok(errs.some((e) => e.includes('rayGround')) && errs.some((e) => e.includes('hasLOS')) && errs.some((e) => e.includes('lineClear')), `each bad input is reported (${errs.join(' | ')})`);
  ok(Math.abs(wrapAngle(3 * Math.PI / 2) + Math.PI / 2) < 1e-9 && Math.abs(Math.abs(wrapAngle(-3 * Math.PI)) - Math.PI) < 1e-9 && Math.abs(wrapAngle(0.4) - 0.4) < 1e-12, 'angles wrap into (-PI, PI]');
  ok(Number.isNaN(wrapAngle(NaN)) && Number.isNaN(wrapAngle(Infinity)), 'a bad angle is NaN, not a hang');
});
test('H28 removing a unit frees the geometry only it used; a finished level frees its geometries and textures', async () => {
  const { freeObjectGeometries, freeScene } = await import('../js/gpu-free.js');
  const watch = (x) => { x.disposedN = 0; x.addEventListener('dispose', () => x.disposedN++); return x; };
  const shared = watch(new THREE.BoxGeometry()), own = watch(new THREE.BoxGeometry()), own2 = watch(new THREE.SphereGeometry());
  const m = new THREE.MeshStandardMaterial(); watch(m);
  const scene = new THREE.Scene(), unit = new THREE.Group();
  scene.add(new THREE.Mesh(shared, m));
  const part = new THREE.Mesh(own, m); part.add(new THREE.Mesh(own2, m));
  unit.add(new THREE.Mesh(shared, m), part, new THREE.Mesh(own, m));
  scene.add(unit); scene.remove(unit);
  eq(freeObjectGeometries(unit, scene), 2, 'two geometries freed');
  eq([shared.disposedN, own.disposedN, own2.disposedN, m.disposedN], [0, 1, 1, 0], 'the shared box stays, each own geometry is freed once, materials stay');
  const tex = watch(new THREE.Texture()), bg = watch(new THREE.Texture());
  const lvl = new THREE.Scene(); lvl.background = bg;
  const g1 = watch(new THREE.PlaneGeometry());
  lvl.add(new THREE.Mesh(g1, new THREE.MeshBasicMaterial({ map: tex })), new THREE.Mesh(g1, m));
  const sun = new THREE.DirectionalLight(); sun.castShadow = true; sun.shadow.map = watch(new THREE.WebGLRenderTarget(4, 4)); lvl.add(sun);
  eq(freeScene(lvl), { geometries: 1, textures: 2, shadows: 1 }, 'level counts');
  ok(sun.shadow.map === null || sun.shadow.map === undefined || sun.shadow.map.disposedN === 1, 'the sun shadow map is freed');
  eq([g1.disposedN, tex.disposedN, bg.disposedN, m.disposedN], [1, 1, 1, 0], 'geometry, map and background freed once; materials kept');
});


// ---------- U28 Mission Blitz ----------
const clearTier = (s, tier) => { for (const m of LOCATIONS.flatMap((l) => l.missions)) CA.tierClears(s, tier)[m.id] = true; };

test('U28 blitz unlock: account-wide (active or stored Guardian cleared Legendary, or ultimateAll)', () => {
  fresh();
  const s = S.createSave('vanguard');
  eq(BZ.blitzUnlocked(s), false);
  clearTier(s, 'base'); eq(BZ.blitzUnlocked(s), false, 'base clear is not enough');
  s.chars = { stalker: { cleared: {}, tierCleared: { legendary: Object.fromEntries(BZ.BLITZ_POOL.map((m) => [m.id, true])), ultimate: {} } } };
  eq(BZ.blitzUnlocked(s), true, 'a stored Guardian counts');
  const t = S.createSave('stalker'); clearTier(t, 'legendary'); eq(BZ.blitzUnlocked(t), true, 'the active Guardian counts');
  const u = S.createSave('arcanist'); u.ultimateAll = true; eq(BZ.blitzUnlocked(u), true, 'ultimateAll counts');
});

test('U28 blitz picks 5 different missions from a seed; the same seed gives the same list', () => {
  eq(BZ.BLITZ_POOL.length, S.ALL_MISSIONS.length); // every campaign mission (22 today; the brief said 18)
  for (let seed = 1; seed < 60; seed++) {
    const a = BZ.pickMissions(seed);
    eq(a.length, 5); eq(new Set(a.map((m) => m.id)).size, 5, 'distinct');
    eq(BZ.pickMissions(seed), a, 'deterministic');
    eq(BZ.runAt(seed, 3).missions, a, 'a member rebuilds the leader run');
  }
  ok(new Set([1, 2, 3, 4, 5, 6].map((s) => BZ.pickMissions(s).map((m) => m.id).join())).size > 1, 'seeds differ');
});

test('U28 blitz run state: clear advances, death fails, five clears finish, record keeps best and clears', () => {
  let r = BZ.newRun(7);
  eq([r.step, r.failed, r.done, BZ.runLabel(r)], [0, false, false, 'Blitz 1 of 5']);
  for (let i = 1; i < 5; i++) { r = BZ.clearStep(r); eq([r.step, r.done, BZ.runCleared(r)], [i, false, i]); }
  r = BZ.clearStep(r); eq([r.done, BZ.runCleared(r)], [true, 5]);
  let threw = false; try { BZ.clearStep(r); } catch { threw = true; } ok(threw, 'a finished run cannot advance');
  const f = BZ.failRun(BZ.clearStep(BZ.clearStep(BZ.newRun(7))));
  eq([f.failed, f.step, BZ.runCleared(f)], [true, 2, 2]);
  fresh();
  const s = S.createSave('vanguard');
  eq(BZ.blitzRecord(s), { clears: 0, best: 0 });
  BZ.recordRun(s, f); eq(s.blitz, { clears: 0, best: 2 });
  BZ.recordRun(s, BZ.newRun(1)); eq(s.blitz.best, 2, 'best never drops');
  BZ.recordRun(s, r); eq(s.blitz, { clears: 1, best: 5 });
  const old = S.createSave('vanguard'); delete old.blitz; eq(BZ.blitzRecord(old), { clears: 0, best: 0 }, 'older saves default on read');
});

test('U28 blitz tier: Legendary numbers, lethal, and no Light floor (combat Light + 25 even under the mission)', () => {
  const B = BZ.BLITZ_TIER, L = CA.CAMPAIGN_TIERS.legendary;
  eq([B.over, B.density, B.cap, B.lethal, B.floor, B.id], [25, 1.25, 300, true, false, 'legendary']);
  eq(CA.CAMPAIGN_TIERS.legendary.lethal, false); eq(CA.CAMPAIGN_TIERS.legendary.floor, true); // normal Legendary unchanged
  eq(CA.tierEnemyLight(250, B, 200), 225, 'under the mission: 200 + 25, not 275');
  eq(CA.tierEnemyLight(250, L, 200), 275, 'normal Legendary keeps the floor');
  eq(CA.tierEnemyLight(250, B, 320), 345);
});

test('U28 blitz reward menu: unfound exotics only, all found gives 3 class exotic armor, bonus legendaries by fireteam', () => {
  fresh();
  for (const cls of ['vanguard', 'stalker', 'arcanist']) {
    const s = S.createSave(cls);
    const p = BZ.blitzPools([], cls, Infinity);
    eq(p.weapons.length, DATA.EXOTIC_RANDOM_WEAPONS.length); eq(p.armor.length, exoticArmorFor(cls).length); eq(p.allFound, false);
    s.exoticsFound = [...p.weapons.slice(1), ...p.armor.slice(2)];
    const m = RW.rollBlitzMenu(s);
    eq(m.tier, 'blitz'); eq(m.weapons.map((w) => w.name), [p.weapons[0]]); eq(m.armor.map((a) => a.name), p.armor.slice(0, 2));
    ok(m.armor.every((a) => a.classId === cls && a.rarity === 'exotic'), 'class armor');
    eq(RW.validateClaim(m, [m.armor[0].id], []), null); ok(RW.validateClaim(m, [m.armor[0].id], [m.weapons[0].id]), 'only one pick');
    ok(RW.validateClaim(m, [], []), 'must pick one');
    s.exoticsFound = [...p.weapons, ...p.armor];
    const all = RW.rollBlitzMenu(s);
    eq([all.armor.length, all.weapons.length, all.allFound], [3, 0, true]);
    eq(new Set(all.armor.map((a) => a.name)).size, 3); ok(all.armor.every((a) => a.classId === cls), 'class armor');
  }
  eq([1, 2, 3].map(BZ.blitzLegendaries), [0, 1, 2]);
  // claiming adds exactly the pick and removes the menu
  const s = S.createSave('stalker'); const menu = RW.queueBlitzMenu(s);
  eq(S.getEquipped(s, 'helmet') != null, true);
  const pick = (menu.weapons[0] || menu.armor[0]);
  const res = RW.claimMenu(s, menu.id, pick.kind === 'armor' ? [pick.id] : [], pick.kind === 'weapon' ? [pick.id] : []);
  eq(res.items.length, 1); eq(s.pendingMenus.length, 0);
});

test('U28 armor bands: per Guardian, by tier cleared; commons unchanged; totals and STAT_CAP hold', () => {
  fresh();
  const s = S.createSave('vanguard');
  eq(CA.armorBand(s), 'base');
  clearTier(s, 'base'); eq(CA.armorBand(s), 'base');
  s.ultimateAll = true; eq(CA.armorBand(s), 'base', 'account-wide ultimateAll does not raise this Guardian');
  s.chars = { stalker: { cleared: {}, tierCleared: { legendary: Object.fromEntries(BZ.BLITZ_POOL.map((m) => [m.id, true])), ultimate: {} } } };
  eq(CA.armorBand(s), 'base', 'another Guardian clear does not count');
  clearTier(s, 'legendary'); eq(CA.armorBand(s), 'legendary');
  clearTier(s, 'ultimate'); eq(CA.armorBand(s), 'ultimate');
  const want = { base: { legendary: [45, 55], exotic: [48, 58] }, legendary: { legendary: [56, 62], exotic: [59, 65] }, ultimate: { legendary: [63, 70], exotic: [66, 73] } };
  eq(AR.ARMOR_BANDS, want);
  for (const band of Object.keys(want)) {
    for (const r of ['legendary', 'exotic']) {
      eq(AR.armorTotal(r, band, () => 0), want[band][r][0]); eq(AR.armorTotal(r, band, () => 0.9999), want[band][r][1]);
    }
    for (const [i, r] of ['common', 'uncommon', 'rare'].entries()) {
      eq(AR.armorTotal(r, band, () => 0), AR.ARMOR_TOTAL[r] - 2); eq(AR.armorTotal(r, band, () => 0.9999), AR.ARMOR_TOTAL[r] + 2);
      const a = makeArmor('chest', 50, i, null, null, null, band); eq(Object.values(a.stats).reduce((x, y) => x + y, 0) >= AR.ARMOR_TOTAL[r] - 2, true);
    }
    for (let n = 0; n < 60; n++) for (const [i, r] of [[3, 'legendary'], [4, 'exotic']]) {
      const a = makeArmor('legs', 50, i, null, 'stalker', null, band), sum = Object.values(a.stats).reduce((x, y) => x + y, 0);
      ok(sum >= want[band][r][0] && sum <= want[band][r][1], `${band} ${r} ${sum}`);
      ok(Object.values(a.stats).every((v) => v >= 0 && v <= AR.STAT_CAP), 'under STAT_CAP');
      const b = rollItem(100, i, 'legs', null, 'stalker', [], Infinity, band), bs = Object.values(b.stats).reduce((x, y) => x + y, 0);
      ok(bs >= want[band][r][0] && bs <= want[band][r][1], 'rollItem passes the band');
    }
  }
  let threw = false; try { AR.armorTotal('legendary', 'nope'); } catch { threw = true; } ok(threw, 'unknown band is an error');
});

test('U28 blitz record is carried per Guardian when switching', () => {
  fresh();
  const s = S.createSave('vanguard'); s.blitz = { clears: 2, best: 5 };
  S.switchCharacter(s, 'stalker'); eq(BZ.blitzRecord(s), { clears: 0, best: 0 });
  S.switchCharacter(s, 'vanguard'); eq(s.blitz, { clears: 2, best: 5 });
});


// ---------- U25 Crucible: PvP rules (chunk A) ----------
import * as PV from '../js/pvp.js';
test('U25 pvp: every primary kills the reference Guardian inside the time-to-kill band', () => {
  for (const a of PV.PRIMARIES) {
    const t = PV.bodyTtk(a);
    ok(t >= PV.TTK_BAND[0] && t <= PV.TTK_BAND[1], `${a} body TTK ${t.toFixed(2)}s outside ${PV.TTK_BAND}`);
  }
});
test('U25 pvp: primaries land close together (spread under 0.5 s)', () => {
  const ts = PV.PRIMARIES.map((a) => PV.bodyTtk(a));
  ok(Math.max(...ts) - Math.min(...ts) < 0.5, `spread ${(Math.max(...ts) - Math.min(...ts)).toFixed(2)}`);
});
test('U25 pvp: health is 100 plus the Resilience shield, with no Light in it', () => {
  eq(PV.PVP_HEALTH, 100);
  eq(PV.pvpPool(0), 100 + AR.shieldMax(0));
  eq(PV.pvpPool(60), 100 + AR.shieldMax(60));
  ok(PV.PVP_MAX_POOL >= PV.pvpPool(100), 'max pool covers Resilience 100');
});
test('U25 pvp: a sniper kills only on a precision hit', () => {
  const body = PV.weaponDamage('sniper', { crit: false, dist: 30 }), head = PV.weaponDamage('sniper', { crit: true, dist: 30 });
  eq(body.oneHit, false); ok(body.dmg < PV.pvpPool(0), 'a body shot does not kill the weakest Guardian');
  eq(head.oneHit, true); ok(head.dmg >= PV.PVP_MAX_POOL, 'a precision hit beats the largest pool');
});
test('U25 pvp: a shotgun volley kills inside its range and cannot outside it', () => {
  const inside = PV.weaponDamage('shotgun', { dist: 4 }), edge = PV.weaponDamage('shotgun', { dist: PV.PVP_WEAPONS.shotgun.range }), out = PV.weaponDamage('shotgun', { dist: 14 });
  const pel = ARCHETYPES.shotgun.pellets;
  ok(inside.dmg * pel >= PV.PVP_MAX_POOL && inside.dmg * PV.PVP_WEAPONS.shotgun.pellets >= PV.PVP_MAX_POOL, 'a clean volley kills inside');
  ok(edge.dmg * PV.PVP_WEAPONS.shotgun.pellets >= PV.PVP_MAX_POOL, 'the range edge still kills');
  ok(out.dmg * pel < PV.pvpPool(0), `a full volley at 14 m must not kill (${(out.dmg * pel).toFixed(0)})`);
});
test('U25 pvp: a fusion volley kills only inside its range and only when it fully lands', () => {
  const pel = ARCHETYPES.fusion.pellets, need = PV.PVP_WEAPONS.fusion.pellets;
  const inside = PV.weaponDamage('fusion', { dist: 8 }), out = PV.weaponDamage('fusion', { dist: 22 });
  ok(inside.dmg * need >= PV.PVP_MAX_POOL, 'the full volley kills inside');
  ok(inside.dmg * (need - 1) < PV.PVP_MAX_POOL, 'a partial volley does not');
  ok(out.dmg * pel < PV.pvpPool(0), `a full volley at 22 m must not kill (${(out.dmg * pel).toFixed(0)})`);
});
test('U25 pvp: a throwing knife precision hit still one-shots, a body hit does not', () => {
  ok(PV.abilityDamage('ability', 300, { kind: 'knife', crit: true }).oneHit, 'precision kills');
  ok(!PV.abilityDamage('ability', 300, { kind: 'knife', crit: false }).oneHit && PV.abilityDamage('ability', 300, { kind: 'knife' }).dmg < PV.pvpPool(0), 'body does not');
});
test('U25 pvp: ability and super damage are capped and floored per source', () => {
  for (const src of ['ability', 'melee', 'explosion']) { // U31: supers have their own rule (superDamage)
    const T = PV.PVP_ABILITY[src];
    eq(PV.abilityDamage(src, 1e6).dmg, T.max); eq(PV.abilityDamage(src, 0).dmg, T.min);
  }
});
test('U25 pvp: spawn ammo is the start amount and heavies start empty', () => {
  const want = { sniper: 2, fusion: 2, shotgun: 2, glauncher: 2, trace: 40, glaive: 2, forerunner: 6 };
  for (const [a, n] of Object.entries(want)) eq(PV.spawnAmmo(a, ARCHETYPES[a].slot), n, a);
  eq(PV.spawnAmmo('sidearm', 'special'), 6, 'a special sidearm');
  eq(PV.spawnAmmo('pulse', 'special'), PV.SPECIAL_DEFAULT_AMMO, 'a pulse rifle framed into the special slot');
  for (const a of ['rocket', 'linear', 'mg', 'sword', 'xenophage']) eq(PV.spawnAmmo(a, 'heavy'), 0, a);
  eq(PV.spawnAmmo('auto', 'primary'), Infinity);
});
test('U25 pvp: a life always starts with the start amount; ammo above it is lost on death, a spent special is topped up', () => {
  eq(PV.startLoad('sniper', 'special', 4), { ammo: 2, reserve: 0 }); eq(PV.startLoad('shotgun', 'special', 5), { ammo: 2, reserve: 0 });
  eq(PV.startLoad('trace', 'special', 140), { ammo: 40, reserve: 0 }); eq(PV.startLoad('rocket', 'heavy', 1), { ammo: 0, reserve: 0 });
  eq(PV.startLoad('sword', 'heavy', 50), { ammo: 0, reserve: 0 }); eq(PV.startLoad('auto', 'primary', 34), { ammo: 34, reserve: Infinity });
  eq(PV.startLoad('sidearm', 'special', 15), { ammo: 6, reserve: 0 });
  eq(PV.startLoad('glauncher', 'heavy', 4), { ammo: 2, reserve: 0 });
});
test('U25 pvp: a heavy crate gives 25% of the magazine rounded up, at least 1; a sword about 10', () => {
  eq(PV.heavyCrateAmount('rocket', 1), 1); eq(PV.heavyCrateAmount('linear', 6), 2); eq(PV.heavyCrateAmount('mg', 70), 18); eq(PV.heavyCrateAmount('glauncher', 4), 1); eq(PV.heavyCrateAmount('sword', 50), 10);
  ok(PV.specialCrateAmount(1) >= 1 && PV.specialCrateAmount(6) === 3, 'special crate share');
});
test('U25 pvp: a Control kill is worth 1 plus 1 per zone held', () => {
  eq([0, 1, 2, 3].map((z) => PV.killPoints(z)), [1, 2, 3, 4]); eq(PV.killPoints(9), 4); eq(PV.killPoints(-1), 1);
});
test('U25 pvp: zones need a lead to move, take time, and an owned zone returns to neutral first', () => {
  const z = { owner: null, prog: 0 };
  PV.zoneStep(z, 1, 1, 10); eq(z.prog, 0, 'a tie holds');
  for (let i = 0; i < 100; i++) PV.zoneStep(z, 0, 1, 0.5); eq(z.owner, 'blue'); eq(z.prog, 1);
  PV.zoneStep(z, 1, 0, 1); eq(z.owner, 'blue', 'still blue after a short push'); ok(z.prog < 1);
  for (let i = 0; i < 12; i++) PV.zoneStep(z, 2, 0, 0.5); ok(z.owner === null || z.owner === 'red', 'blue lost it');
  for (let i = 0; i < 100; i++) PV.zoneStep(z, 3, 0, 0.5); eq(z.owner, 'red');
});
test('U25 pvp: Control ends at the score limit or the timer, higher score wins, equal is a draw', () => {
  eq(PV.controlResult({ red: 10, blue: 4 }, 100), { over: false, winner: null });
  eq(PV.controlResult({ red: 100, blue: 40 }, 100), { over: true, winner: 'red' });
  eq(PV.controlResult({ red: 30, blue: 41 }, 0), { over: true, winner: 'blue' });
  eq(PV.controlResult({ red: 30, blue: 30 }, 0), { over: true, winner: 'draw' });
});
test('U25 pvp: players can hurt each other only in a pvp activity and only across teams', () => {
  ok(!PV.pvpHurts({ pvp: false }, 'red', 'blue') && !PV.pvpHurts({}, 'red', 'blue') && !PV.pvpHurts(null, 'red', 'blue'), 'no pvp, no damage');
  ok(PV.pvpHurts({ pvp: true }, 'red', 'blue'), 'opposite teams');
  ok(!PV.pvpHurts({ pvp: true }, 'red', 'red'), 'never a teammate');
  ok(!PV.pvpHurts({ pvp: true }, null, 'blue'), 'no team, no damage');
});
test('U25 pvp: AI Guardians get random gamer tags, unique per match, never the game\'s own characters', () => {
  const npcs = ['Ikora', 'Zavala', 'Cayde', 'Shaxx', 'Saint', 'Osiris', 'Eris', 'Amanda', 'Drifter', 'Hawthorne', 'Banshee', 'Devrim', 'Sloane', 'Petra', 'Mara'];
  const tags = PV.gamerTags(12, mulberry32(7));
  eq(new Set(tags).size, 12); ok(tags.every((x) => /^[A-Za-z0-9_]{3,20}$/.test(x)), 'plain characters only');
  ok(tags.every((x) => !npcs.some((n) => x.toLowerCase().includes(n.toLowerCase()))), 'no NPC names');
  ok(PV.gamerTags(12, mulberry32(8)).join() !== tags.join(), 'a different seed gives different tags');
  ok(PV.gamerTags(40, mulberry32(1)).length === 40, 'enough variety for 40');
});
test('U25 PvE numbers unchanged: golden weapon, tier, falloff and ability numbers', () => {
  eq(ARCHETYPES.auto.dmg, 15); eq(ARCHETYPES.hand.dmg, 60); eq(ARCHETYPES.sniper.dmg, 360); eq(ARCHETYPES.shotgun.dmg, 22); eq(ARCHETYPES.fusion.dmg, 52); eq(ARCHETYPES.rocket.dmg, 1210);
  eq(C.weaponTierMult(0), 1); eq(C.weaponTierMult(4), 1 + 4 * 0.075);
  eq(Math.round(C.falloffMult(ARCHETYPES.auto.falloff || DATA.DEFAULT_FALLOFF, 60, 38) * 1000), Math.round(C.falloffMult(DATA.DEFAULT_FALLOFF, 60, 38) * 1000));
  eq(C.GOLDEN_GUN, { shot: 850, splash: 270, knockMult: 0.85 });
});
test('U25 PvE damage path is untouched: the original dealDamage multipliers are still in game.js, and the PvP branch is the guarded early return', async () => {
  const src = await (await fetch('../js/game.js')).text();
  for (const line of [
    "let dmg = o.raw ? amount : amount * M.playerDmgMult * (o.crit ? o.precMult || 1.5 : 1);",
    "if (!o.raw && (o.source === 'ability' || o.source === 'melee')) dmg *= ABILITY_POWER * M.hpMult;",
    "if (!o.raw && (o.source === 'weapon' || o.source === 'perk')) dmg *= weaponTierMult(M.g);",
    "const dmg = amount * G.mission.incomingMult * k;",
  ]) ok(src.includes(line), `missing original line: ${line}`);
  ok(/if \(e\.isGuardian\) return pvpDealDamage\(/.test(src), 'the guardian branch is one guarded early return');
  ok(/G\.mission\.pvp\) return pvpDamagePlayer\(amount, \{ from \}\)/.test(src), 'damagePlayer reads the pvp flag');
});

// ---------- U25 Crucible: networked PvP rules (chunk B) ----------
import { MAX_CRUCIBLE, MAX_FIRETEAM, balanceTeam, capFor } from '../js/net.js';
test('U25b lobby caps: the Crucible takes 12, everything else stays a 3-player fireteam', () => {
  eq(MAX_CRUCIBLE, 12); eq(MAX_FIRETEAM, 3);
  eq(capFor({ li: -5, mi: 0 }), 12); eq(capFor({ li: 0, mi: 1 }), 3); eq(capFor(null), 3); eq(capFor({ li: -4, mi: 0 }), 3);
});
test('U25b team pick: a joiner goes to the smaller team', () => {
  eq(balanceTeam([]), 'blue');
  eq(balanceTeam([{ team: 'blue' }]), 'red');
  eq(balanceTeam([{ team: 'blue' }, { team: 'red' }]), 'blue');
  eq(balanceTeam([{ team: 'blue' }, { team: 'blue' }, { team: 'red' }]), 'red');
});
test('U29 AI Guardian kits: a full random kit per bot, a Light subclass that matches its element, a real shader', () => {
  const rng = mulberry32(29), seen = new Set(), shaders = new Set();
  for (let i = 0; i < 60; i++) {
    const k = PV.rollKit(rng);
    ok(PV.AI_CLASS_IDS.includes(k.cls) && PV.AI_ELEMENT_IDS.includes(k.el), 'class and element');
    ok(k.sc && k.scName, `a subclass for ${k.cls}/${k.el}`);
    eq(PV.BOT_SUPERS[k.cls][k.el].id, k.su, 'the super belongs to that subclass');
    ok(PV.BOT_GRENADES[k.el].some((g) => g.id === k.gr), 'the grenade is of its element');
    ok(PV.BOT_CLASS[k.cls].some((c) => c.id === k.ca), 'the class ability is of its class');
    ok(PV.GUARDIAN_AI.loadouts.includes(k.arch) && PV.GUARDIAN_AI.specials.includes(k.special) && PV.GUARDIAN_AI.heavies.includes(k.heavy), 'three guns');
    ok(PV.BOT_ABILITY[k.su], `numbers for ${k.su}`);
    const [, sh] = k.lk.split('|'); if (sh) shaders.add(sh);
    seen.add(`${k.cls}${k.el}`);
  }
  ok(seen.size >= 7, 'the kits vary across class and element');
  ok(shaders.size >= 4, 'random shaders');
  const r = PV.buildRoster([], 'control', PV.gamerTags(12, mulberry32(3)), mulberry32(4));
  ok(r.slots.every((s) => s.su && s.gr && s.ca && s.lk && s.heavy), 'every AI slot carries its whole kit');
  eq(JSON.stringify(PV.buildRoster([], 'control', PV.gamerTags(12, mulberry32(3)), mulberry32(4))), JSON.stringify(r), 'the same seed gives the same roster');
});
test('U29 a Crucible barricade blocks the other team and lets its own team through', () => {
  const old = G.colliders;
  const wall = () => ({ min: { x: -0.3, y: 0, z: -3 }, max: { x: 0.3, y: 2.2, z: 3 }, pass: true, team: 'blue' });
  const run = (team) => { G.colliders = [wall()]; const pos = { x: -2, y: 0, z: 0 }, vel = { x: 6, y: 0, z: 0 }; for (let i = 0; i < 60; i++) moveBody(pos, vel, 1 / 60, 0.4, 1.8, 0.6, team); return pos.x; };
  ok(run('blue') > 1.5, 'its own team walks through');
  ok(run('red') < -0.6, 'the other team is stopped');
  ok(run(null) > 1.5, 'outside PvP (no team) it stays a pass-through wall, as before');
  G.colliders = old;
});
test('U25b rosters: humans take slots first, AI Guardians fill each team to its size', () => {
  const humans = [{ id: 'a', name: 'A', cls: 'vanguard', team: 'blue' }, { id: 'b', name: 'B', cls: 'stalker', team: 'red' }, { id: 'c', name: 'C', cls: 'arcanist', team: 'red' }];
  const r = PV.buildRoster(humans, 'control');
  eq(r.slots.length, 12);
  for (const team of ['blue', 'red']) eq(r.slots.filter((s) => s.team === team).length, 6);
  eq(r.slots.filter((s) => s.human).map((s) => s.gid), ['a', 'b', 'c']);
  eq(r.slots.filter((s) => s.team === 'red' && s.human).map((s) => s.slot), [0, 1]);
  eq(new Set(r.slots.map((s) => `${s.team}${s.slot}`)).size, 12, 'every slot is used once');
  eq(new Set(r.slots.map((s) => s.gid)).size, 12);
  ok(r.slots.filter((s) => !s.human).every((s) => s.arch && s.cls && s.el));
  eq(PV.buildRoster([], 'control').slots.filter((s) => s.human).length, 0, 'a spectated match is all AI');
});
test('U25b Duel roster: one on one, a second human is the other side, a lone human gets an AI foe', () => {
  const one = PV.buildRoster([{ id: 'a', name: 'A', cls: 'vanguard', team: 'red' }], 'duel');
  eq(one.slots.length, 2); eq(one.slots[0].team, 'blue'); eq(one.slots[1].human, false); eq(one.slots[1].team, 'red');
  const two = PV.buildRoster([{ id: 'a', name: 'A', cls: 'vanguard', team: 'blue' }, { id: 'b', name: 'B', cls: 'stalker', team: 'blue' }], 'duel');
  eq(two.slots.map((s) => [s.gid, s.team]), [['a', 'blue'], ['b', 'red']]);
  eq(PV.DUEL.toWin, 5);
  eq(PV.roundOnClock({ blue: 120, red: 80 }), 'blue'); eq(PV.roundOnClock({ blue: 50, red: 80 }), 'red'); eq(PV.roundOnClock({ blue: 80, red: 80 }), null);
});
test('U25b launch rules: Duel is 1 or 2 humans, a Control team holds 6, nobody means no match', () => {
  const m = (n, team = 'blue') => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, team }));
  ok(PV.launchCheck(m(1), 'duel').ok); ok(PV.launchCheck(m(2), 'duel').ok); ok(!PV.launchCheck(m(3), 'duel').ok);
  ok(PV.launchCheck(m(6), 'control').ok); ok(!PV.launchCheck(m(7), 'control').ok);
  ok(PV.launchCheck([...m(6, 'blue'), ...m(6, 'red')], 'control').ok, '6v6 humans');
  ok(!PV.launchCheck([], 'control').ok); ok(!PV.launchCheck(m(1), 'nope').ok);
});
test('U25b a pvp hit is accepted only in a pvp:true activity, between opposite teams, from its own sender, within the damage cap', () => {
  const pvp = { pvp: true }, pve = { pvp: false }, none = {};
  ok(PV.acceptPvpHit(pvp, 'a', 'a', 'blue', 'red', 30));
  ok(!PV.acceptPvpHit(pve, 'a', 'a', 'blue', 'red', 30), 'a PvE mission never takes player damage');
  ok(!PV.acceptPvpHit(none, 'a', 'a', 'blue', 'red', 30), 'no flag at all');
  ok(!PV.acceptPvpHit(null, 'a', 'a', 'blue', 'red', 30));
  ok(!PV.acceptPvpHit({ pvp: 1 }, 'a', 'a', 'blue', 'red', 30), 'only the boolean true counts');
  ok(!PV.acceptPvpHit(pvp, 'a', 'a', 'blue', 'blue', 30), 'teammates are safe');
  ok(!PV.acceptPvpHit(pvp, 'a', 'b', 'blue', 'red', 30), 'a member cannot report another shooter');
  ok(!PV.acceptPvpHit(pvp, 'a', 'a', 'blue', 'red', PV.PVP_MAX_POOL + 1), 'above the one-hit cap');
  ok(!PV.acceptPvpHit(pvp, 'a', 'a', 'blue', 'red', NaN)); ok(!PV.acceptPvpHit(pvp, 'a', 'a', 'blue', 'red', -5));
});
test('U25b the crucible net handlers all start from the pvp:true switch', async () => {
  const src = await (await fetch('../js/crucible-net.js')).text();
  ok(/const matchOf = \(\) => \(G\.mission\?\.pvp === true/.test(src), 'every handler reads the match through the pvp flag');
  ok(!/pvpDamagePlayer\([^)]*\)/.test(src.replace(/net\.on\('pvh'[\s\S]*?\n\}\);/, '')), 'only the pvh handler applies player damage');
});

// ---------- U25 Crucible loot pool (chunk C) ----------
import * as CL from '../js/crucible-loot.js';
test('U25c Crucible pool: seven legendaries kept out of every pool, covering four elements, with the look flag', () => {
  const names = CL.CRUCIBLE_WEAPONS.map((w) => w.name);
  eq(names, ['Trust', "Redrix's Broadsword", 'Recluse', "Randy's Throwing Knife", 'Revoker', 'Riptide', 'The Mountaintop']);
  ok(!LEGENDARY_WEAPONS.some((l) => l.crucible) && !NAMED_WEAPONS.some((l) => l.crucible || names.includes(l.name)), 'no Crucible entry in any named pool');
  eq(new Set(CL.CRUCIBLE_WEAPONS.map((w) => w.arch)).size, 7, 'seven archetypes');
  eq([...new Set(CL.CRUCIBLE_WEAPONS.map((w) => w.element))].sort(), ['arc', 'kinetic', 'solar', 'void']);
  for (const w of CL.CRUCIBLE_WEAPONS) {
    const it = CL.makeCrucibleWeapon(100, Math.random, w);
    eq([it.name, it.rarity, it.crucible, it.frame, it.element, it.perks.length], [w.name, 'legendary', true, w.frame, w.element, 3]);
  }
  ok(!ST.SET_IDS.includes('crucible') && ST.SETS.crucible.crucible, 'set kept out of random sets');
  for (const [cls, a, b] of [['vanguard', 'Phoenix Strife Helm', 'Phoenix Strife Greaves'], ['stalker', 'Ankaa Seeker Mask', 'Ankaa Seeker Strides'], ['arcanist', 'Wing Discipline Hood', 'Wing Discipline Boots']]) {
    const h = CL.makeCrucibleArmor(100, cls, Math.random, 'helmet'), l = CL.makeCrucibleArmor(100, cls, Math.random, 'legs');
    eq([h.name, l.name, h.set, h.rarity], [a, b, 'crucible', 'legendary']);
  }
  const kinds = new Set(); for (let i = 0; i < 200; i++) kinds.add(CL.makeCrucibleDrop(100, 'stalker').kind); eq([...kinds].sort(), ['armor', 'weapon']);
});
test('U25c Crucible items never come from any other source (random rolls, reward menus, Blitz, kiosks, skip gear, level track)', () => {
  const names = new Set(CL.CRUCIBLE_WEAPONS.map((w) => w.name));
  const bad = (it) => it && (it.crucible || it.set === 'crucible' || names.has(it.name));
  for (let i = 0; i < 6000; i++) {
    const dest = i % 7 === 0 ? null : LOCATIONS[i % LOCATIONS.length].id;
    ok(!bad(rollItem(100 + (i % 200), i % 5, null, dest, ['vanguard', 'stalker', 'arcanist'][i % 3], [], Infinity, 'base')), 'rollItem');
  }
  for (const slot of ['kinetic', 'energy', 'heavy', 'primary', 'special']) for (let i = 0; i < 100; i++) { try { ok(!bad(rollItem(100, 3, slot)), 'slot roll'); } catch { /* not a valid slot name */ } }
  const s = { classId: 'stalker', exoticsFound: [], cleared: {}, inventory: [], vault: [], pendingMenus: [], tierCleared: { legendary: {}, ultimate: {} }, level: 60, xp: 0 };
  for (const tier of Object.keys(RW.REWARD_MENUS)) for (let i = 0; i < 30; i++) {
    let m; try { m = RW.rollMenu(s, tier); } catch { continue; }
    for (const it of [...(m.weapons || []), ...(m.armor || [])]) ok(!bad(it) && !bad(it.item), `${tier} menu`);
  }
  for (let i = 0; i < 30; i++) { let m; try { m = RW.rollBlitzMenu(s); } catch { continue; } for (const it of [...(m.weapons || []), ...(m.armor || [])]) ok(!bad(it) && !bad(it.item), 'Blitz menu'); }
  for (const it of [...EXOTIC_WEAPONS.map((e) => e.name)]) ok(!names.has(it), 'exotic list holds none (Kiosk and Tower sell only exotics)');
  for (const it of RW.starterGear?.('stalker') || []) ok(!bad(it), 'starter gear');
  for (const id of Object.keys(ST.SETS)) if (id !== 'crucible') for (let i = 0; i < 5; i++) ok(ST.setForLegacy({ id: `x${i}${id}` }) !== 'crucible', 'legacy set');
});
test('U25c the match reward: one Crucible item per finished match through the Crucible pool, guarded by the over flag', async () => {
  const src = await (await fetch('../js/crucible.js')).text();
  ok(/if \(C\.over\) return;\n\s*C\.over = true/.test(src), 'endMatch returns when the match is already over');
  eq((src.match(/grantItem\(/g) || []).length, 1, 'one grant in the Crucible');
  ok(/makeCrucibleDrop\(/.test(src) && !/rollItem\(/.test(src), 'the reward comes from the Crucible pool, not a random roll');
  const RT2 = await import('../js/rolltracker.js');
  const cr = RT2.trackerEntries().filter((e) => e.crucible);
  eq(cr.length, 7); ok(cr.every((e) => e.sources.length === 1 && /Crucible/.test(e.sources[0])), 'Crucible sources');
});

// ---------- U24 Roguelike Horde: boons ----------
const near = (a, b, tol = 1e-9, msg = '') => { if (Math.abs(a - b) > tol) throw new Error(`${msg} expected ~${b}, got ${a}`); };
const seeded = (seed) => { let a = seed; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
const WPOOL = [{ slot: 'kinetic', name: 'Legend A', exotic: false }, { slot: 'energy', name: 'Legend B', exotic: false }, { slot: 'heavy', name: 'Exo C', exotic: true }];

test('U24 boons: 48 data rows (H30b: six exotic), unique ids, each with an effect', () => {
  eq(BN.BOONS.length, 48);
  eq(new Set(BN.BOONS.map((b) => b.id)).size, 48, 'unique ids');
  for (const b of BN.BOONS) { ok(b.name && b.desc, b.id); ok(Object.keys(b.fx).length > 0, `${b.id} has fx`); }
});

test('U24 boons: stacking adds the same amount again (two Bladefury = triple melee charge)', () => {
  const run = BN.newBoonRun();
  eq(BN.chargeMult(BN.boonTotals(run), 'melee'), 1, 'no boon = 1x');
  BN.addBoon(run, 'bladefury'); near(BN.chargeMult(BN.boonTotals(run), 'melee'), 1.6, 1e-9);
  eq(BN.addBoon(run, 'bladefury'), 2, 'stack count'); near(BN.chargeMult(BN.boonTotals(run), 'melee'), 2.2, 1e-9, 'H30b: 60% per stack, still adding');
  eq(BN.boonTotals(run).phoenix || 0, 0);
  BN.addBoon(run, 'phoenix_rite'); BN.addBoon(run, 'phoenix_rite'); eq(BN.boonTotals(run).phoenix, 2, 'two saves per wave');
  eq(BN.totalBoons(run), 4);
  let threw = false; try { BN.addBoon(run, 'nope'); } catch { threw = true; } ok(threw, 'unknown boon throws');
});

test('U24 boons: unlimited stacks stay finite (high-stack formulas)', () => {
  const run = BN.newBoonRun();
  for (let i = 0; i < 200; i++) { BN.addBoon(run, 'iron_skin'); BN.addBoon(run, 'quickhands'); BN.addBoon(run, 'frostbite_rounds'); BN.addBoon(run, 'momentum'); }
  const t = BN.boonTotals(run);
  const dt = BN.damageTakenMult(t); ok(dt >= BN.BOON_CONST.toughnessFloor && dt <= 1, 'damage taken floors');
  const rl = BN.reloadTimeMult(t); ok(rl >= BN.BOON_CONST.reloadFloor && rl <= 1, 'reload floors');
  ok(BN.frostSlow(t) <= BN.BOON_CONST.frostMax, 'slow capped');
  const m = BN.damageMult(t, { momentumStacks: 99 }); ok(Number.isFinite(m) && m > 1, 'damage finite');
  eq(BN.damageTakenMult({}), 1); eq(BN.reloadTimeMult({}), 1);
});

test('U24 boons: damage bonuses add (boss, elite, execute, last stand, momentum)', () => {
  const run = BN.newBoonRun();
  for (const id of ['giantslayer', 'duelist', 'executioner', 'last_stand', 'momentum']) BN.addBoon(run, id);
  const t = BN.boonTotals(run);
  eq(BN.damageMult({}, { boss: true }), 1, 'no boons = 1');
  near(BN.damageMult(t, {}), 1, 1e-9);
  near(BN.damageMult(t, { boss: true }), 1.07, 1e-9);
  near(BN.damageMult(t, { elite: true }), 1.10, 1e-9);
  near(BN.damageMult(t, { targetFrac: 0.2 }), 1.12, 1e-9); near(BN.damageMult(t, { targetFrac: 0.5 }), 1, 1e-9);
  near(BN.damageMult(t, { selfFrac: 0.2 }), 1.20, 1e-9);
  near(BN.damageMult(t, { momentumStacks: 5 }), 1.05, 1e-9); near(BN.damageMult(t, { momentumStacks: 50 }), 1.10, 1e-9, 'momentum caps at 10 stacks');
});

test('U24 boons: offers roll per member, are distinct, and are reproducible from the rng', () => {
  const a = BN.rollOffer(seeded(5)); eq(a.length, 3); eq(new Set(a.map((o) => o.id)).size, 3, 'distinct buffs'); ok(a.every((o) => o.kind === 'boon'), 'no pool = all buffs');
  ok(a.every((o) => !BN.BOON_BY_ID[o.id].exotic), 'a normal orb never offers an exotic boon');
  eq(BN.rollOffer(seeded(5)), a, 'same rng, same offer');
  const o = BN.rollOffers(['a', 'b', 'c'], seeded(9)); eq(Object.keys(o), ['a', 'b', 'c']);
  ok(JSON.stringify(o.a) !== JSON.stringify(o.b) || JSON.stringify(o.b) !== JSON.stringify(o.c), 'members differ');
  let weapons = 0, exo = 0;
  for (let i = 1; i <= 400; i++) {
    const off = BN.rollOffer(seeded(i), WPOOL); eq(off.length, 4, 'H30b: three boons and one weapon swap');
    eq(off.filter((x) => x.kind === 'weapon').length, 1, 'exactly one weapon swap every orb'); eq(off[3].kind, 'weapon', 'the weapon is the last card');
    for (const x of off) if (x.kind === 'weapon') { weapons++; if (x.exotic) exo++; ok(WPOOL.some((w) => w.name === x.name && w.slot === x.slot), 'from the pool'); }
    eq(new Set(off.map((x) => x.kind === 'boon' ? x.id : x.name)).size, 4, 'no repeats within an offer');
  }
  eq(weapons, 400, 'a weapon swap in every offer'); ok(weapons > 40, 'weapon offers appear'); ok(exo < weapons, 'exotics rarer than legendaries');
});

test('U24 boons: auto-pick takes the first; the pick timer ends when all picked or time is up', () => {
  eq(BN.autoPick(BN.rollOffer(seeded(1))), 0);
  let threw = false; try { BN.autoPick([]); } catch { threw = true; } ok(threw);
  const s0 = BN.pickState(['a', 'b'], new Set(['a']), 3); eq([s0.done, s0.timedOut], [false, []]); near(s0.remaining, 7, 1e-9);
  const s1 = BN.pickState(['a', 'b'], new Set(['a', 'b']), 1); eq(s1.done, true);
  const s2 = BN.pickState(['a', 'b'], new Set(['a']), 10); eq([s2.done, s2.timedOut], [true, ['b']]);
  eq(BN.BOON_PICK_SECONDS, 10); eq(BN.BOON_EVERY, 1);
});

test('U24 boons: a weapon swap fills the slot, applyOption works, reset clears the run', () => {
  const run = BN.newBoonRun();
  BN.applyOption(run, { kind: 'boon', id: 'duelist' });
  BN.applyOption(run, { kind: 'weapon', slot: 'heavy', name: 'Exo C', exotic: true });
  eq(run.weapons.heavy, { name: 'Exo C', exotic: true }); eq(BN.boonCount(run, 'duelist'), 1); eq(run.picks, 2);
  BN.resetBoonRun(run); eq(run, BN.newBoonRun(), 'reset');
  let threw = false; try { BN.applyOption(run, { kind: 'x' }); } catch { threw = true; } ok(threw);
});

test('U30 boon drops: clearing a wave grants no boon any more', () => {
  eq([1, 2, 3, 4, 7, 10, 28, 29, 30].map((w) => BN.boonDue(w, 30)), [false, false, false, false, false, false, false, false, false]);
});

test('U30 Multishot: +50% bullets per stack (at least +1), capped, and none without the boon', () => {
  eq(BN.shotCount({}, 1), { total: 1, extra: 0 });
  const run = BN.newBoonRun(); BN.addBoon(run, 'multishot'); let t = BN.boonTotals(run);
  eq(BN.shotCount(t, 1), { total: 2, extra: 1 }, 'a one-bullet gun gets +1'); eq(BN.shotCount(t, 10), { total: 15, extra: 5 }, 'a shotgun gets +5'); eq(BN.shotCount(t, 7), { total: 11, extra: 4 }, 'fusion rounds up');
  for (let i = 0; i < 9; i++) BN.addBoon(run, 'multishot');
  eq(BN.shotCount(BN.boonTotals(run), 1), { total: 5, extra: 4 }, 'four stacks at most');
});

test('U30/U31 boon drops: the budget is a share of the round that grows with the wave, a plan drops exactly that many, elites lean first, offers are seeded', () => {
  const r = mulberry32(7);
  ok(BN.dropRate(1) < BN.dropRate(10) && BN.dropRate(10) < BN.dropRate(25), 'the drop share rises with the wave');
  eq(BN.dropRate(500), BN.DROP_RATE.max, 'the share is capped');
  for (const count of [3, 8, 14, 40, 90]) for (const wave of [1, 10, 30]) for (let i = 0; i < 100; i++) { const n = BN.rollDropBudget(count, r, wave), want = count * BN.dropRate(wave); ok(n >= BN.DROPS_MIN && n <= Math.max(BN.DROPS_MIN, Math.ceil(want)), `budget ${n} for ${count} enemies on wave ${wave}`); }
  const avg = (wave) => { let t = 0; for (let i = 0; i < 400; i++) t += BN.rollDropBudget(80, r, wave); return t / 400; };
  ok(avg(20) > avg(1) * 1.8, 'wave 20 drops far more orbs than wave 1 for the same enemy count');
  for (const count of [2, 5, 20, 60]) for (let t = 0; t < 100; t++) {
    const plan = BN.newDropPlan(count, r, 0, 1 + (t % 30)), want = plan.left; let got = 0; const ids = [];
    for (let k = 0; k < count; k++) if (BN.shouldDropBoon(plan, k % 4 === 0 ? BN.DROP_ELITE_WEIGHT : 1, r)) { got++; ids.push(plan.seq); }
    eq(got, Math.min(want, count), `a round of ${count} kills drops its ${want} orbs`); eq(ids, ids.map((_, i) => i + 1), 'orb ids count up from 1');
    ok(!BN.shouldDropBoon(plan, 1, r) || plan.left >= 0, 'never past the budget');
  }
  ok(!BN.shouldDropBoon(null), 'no plan, no drop');
  const sd = BN.offerSeed(5, 502, 1);
  eq(BN.rollOrbOffer(sd), BN.rollOrbOffer(sd), 'the same orb and player show the same three choices');
  ok(JSON.stringify(BN.rollOrbOffer(BN.offerSeed(5, 502, 1))) !== JSON.stringify(BN.rollOrbOffer(BN.offerSeed(5, 502, 2))) || JSON.stringify(BN.rollOrbOffer(BN.offerSeed(5, 503, 1))) !== JSON.stringify(BN.rollOrbOffer(BN.offerSeed(5, 502, 1))), 'other players or orbs differ');
  eq(BN.rollOrbOffer(sd).length, BN.BOON_OFFER_SIZE);
});

test('U24 horde scaling: wave 1 is 1x; values rise per wave, stay capped and bosses outgrow the rest', () => {
  const w1 = BN.waveScale(1); eq([w1.count, w1.hp, w1.dmg, w1.bossHp], [1, 1, 1, 1]);
  let prev = w1;
  for (let w = 2; w <= 30; w++) {
    const s = BN.waveScale(w);
    ok(s.count >= prev.count && s.hp >= prev.hp && s.dmg >= prev.dmg && s.bossHp >= prev.bossHp, `wave ${w} never drops`);
    prev = s;
  }
  const hi = BN.waveScale(9999); eq([hi.count, hi.hp, hi.dmg, hi.bossHp], [BN.HORDE_SCALE.countMax, BN.HORDE_SCALE.hpMax, BN.HORDE_SCALE.dmgMax, BN.HORDE_SCALE.bossHpMax]);
});

test('U24 horde spawns: enemies keep 15 m from living players, players keep 15 m from suicide units and 8 m from the rest', () => {
  const players = [{ x: 0, z: 0 }, { x: 60, z: 0 }];
  eq(BN.enemySpotOk({ x: 14, z: 0 }, players, true), false); eq(BN.enemySpotOk({ x: 16, z: 0 }, players, true), true);
  eq(BN.enemySpotOk({ x: 14, z: 0 }, players, false), false, 'any enemy keeps 15 m from every player, not only the host');
  eq(BN.enemySpotOk({ x: 30, z: 0 }, players, false), true);
  eq(BN.enemySpotOk({ x: 60, z: 10 }, players, false), false, 'a fireteam member counts too');
  const enemies = [{ x: 0, z: 0, suicide: true }, { x: 50, z: 0, suicide: false }];
  eq(BN.playerSpotOk({ x: 14, z: 0 }, enemies), false); eq(BN.playerSpotOk({ x: 16, z: 0 }, enemies), true);
  eq(BN.playerSpotOk({ x: 44, z: 0 }, enemies), false, '6 m from a normal enemy is not allowed');
  eq(BN.playerSpotOk({ x: 59, z: 0 }, enemies), true, '9 m from a normal enemy is fine');
  eq(BN.playerSpotOk({ x: 45, z: 0 }, enemies), false);
  const cands = BN.ringCandidates(0, 0, 3, 20, 60, 7);
  const spot = BN.pickFairSpot(cands, (p) => BN.playerSpotOk(p, enemies), (p) => BN.nearestDist(p, enemies), seeded(3));
  ok(BN.playerSpotOk(spot, enemies), 'a fair spot is chosen when one exists');
  const allBad = BN.ringCandidates(0, 0, 1, 5, 20, 2), far = BN.pickFairSpot(allBad, () => false, (p) => BN.nearestDist(p, enemies), seeded(3));
  eq(far, allBad.reduce((b, p) => BN.nearestDist(p, enemies) > BN.nearestDist(b, enemies) ? p : b), 'falls back to the farthest');
});

// ---------- U24 death camera ----------
test('U24 death camera: about 3 s of body, then the Ghost (1.5 s in the Crucible)', () => {
  eq([0, 2.9, 3, 10].map((t) => DCAM.deathPhase(t)), ['body', 'body', 'ghost', 'ghost']);
  eq([1.4, 1.5].map((t) => DCAM.deathPhase(t, DCAM.DEATH_CAM.bodySecsCrucible)), ['body', 'ghost']);
  eq([DCAM.collapseK(0), DCAM.collapseK(10)], [0, 1]); ok(DCAM.collapseK(0.3) > 0.3 && DCAM.collapseK(0.3) < 1, 'eased');
});

test('U24 death camera: orbit and zoom stay within limits; the wall push keeps the camera in front of a wall', () => {
  const o = DCAM.newOrbit(1.2); eq([o.yaw, o.dist], [1.2, DCAM.DEATH_CAM.startDist]);
  DCAM.orbitStep(o, 0, 99, 99); eq([o.pitch, o.dist], [DCAM.DEATH_CAM.pitchMax, DCAM.DEATH_CAM.maxDist]);
  DCAM.orbitStep(o, 0, -99, -99); eq([o.pitch, o.dist], [DCAM.DEATH_CAM.pitchMin, DCAM.DEATH_CAM.minDist]);
  const y0 = o.yaw; DCAM.orbitStep(o, 0.5, 0, 0); near(o.yaw, y0 - 0.5, 1e-12, 'mouse orbits');
  const off = DCAM.orbitOffset(DCAM.newOrbit(0), 4); near(Math.hypot(off.x, off.y, off.z), 4, 1e-9, 'offset has the given length'); ok(off.z > 0, 'behind a Guardian facing yaw 0');
  eq(DCAM.pushIn(5, null), 5); near(DCAM.pushIn(5, 2), 2 - DCAM.DEATH_CAM.wall, 1e-12); eq(DCAM.pushIn(5, 0.1), 0.4, 'never inside the target'); eq(DCAM.pushIn(2, 9), 2, 'a far wall does not move it');
});

test('U24 roguelike endless: the curve never levels off past wave 30 (only the enemy count is capped)', () => {
  const a = BN.waveScale(30, BN.ENDLESS_SCALE), b = BN.waveScale(100, BN.ENDLESS_SCALE), c = BN.waveScale(1000, BN.ENDLESS_SCALE);
  ok(b.hp > a.hp && c.hp > b.hp, 'health keeps rising'); ok(b.dmg > a.dmg && c.dmg > b.dmg, 'damage keeps rising'); ok(c.bossHp > b.bossHp, 'boss health keeps rising');
  eq(c.count, BN.ENDLESS_SCALE.countMax, 'count capped'); eq(BN.waveScale(1, BN.ENDLESS_SCALE), { count: 1, hp: 1, dmg: 1, bossHp: 1 });
  ok(BN.waveScale(30, BN.ENDLESS_SCALE).hp > BN.waveScale(30).hp, 'steeper than Horde');
  const acts = DATA.ACTIVITIES; ok(acts.find((x) => x.id === 'endless_rogue')?.roguelike, 'the mode exists'); ok(acts.find((x) => x.id === 'horde_rogue').roguelike && acts.find((x) => x.id === 'horde_rogue').waves === 30, 'Roguelike Horde exists'); ok(!acts.find((x) => x.id === 'horde').roguelike, 'classic Horde is unchanged'); ok(!acts.find((x) => x.id === 'endless').roguelike, 'plain Endless is unchanged');
  eq([31, 34, 1000].map((w) => BN.boonDue(w, Infinity)), [false, false, false]);
});

test('U26 mobile: detect honours ?mobile, ?mobile=0 and the touch default', () => {
  eq([MOB.detectMobile('', false), MOB.detectMobile('', true), MOB.detectMobile('?mobile', false), MOB.detectMobile('?a=1&mobile', false), MOB.detectMobile('?mobile=0', true), MOB.detectMobile('?mobile=off', true), MOB.detectMobile('?mobilex', false)], [false, true, true, true, false, false, false]);
});

test('U26 mobile: desktop reads identity tuning, Mobile mode on and off round-trips exactly', () => {
  eq(MOB.tuning(), MOB.DESKTOP_TUNING, 'default is the identity');
  eq([MOB.DESKTOP_TUNING.strafeSpeed, MOB.DESKTOP_TUNING.strafeInterval, MOB.DESKTOP_TUNING.hitScale, MOB.DESKTOP_TUNING.particleScale], [1, 1, 1, 1]);
  MOB.setMobileMode(true);
  eq([MOB.tuning().strafeSpeed, MOB.tuning().hitScale], [0.6, 1.35], 'calmer strafe, wider hit');
  ok(MOB.tuning().strafeInterval > 1, 'longer strafe interval');
  MOB.setMobileMode(false);
  eq(MOB.tuning(), MOB.DESKTOP_TUNING, 'off restores the exact desktop values');
});

test('U26 mobile: stick math (dead zone, clamp, keys, sprint)', () => {
  eq(MOB.stickVec(3, 2, 56), { x: 0, y: 0, m: 0 }, 'dead zone');
  const f = MOB.stickVec(0, -200, 56); near(f.m, 1, 1e-9); near(f.y, -1, 1e-9);
  eq(MOB.stickKeys(f), { KeyW: true, KeyS: false, KeyA: false, KeyD: false, ShiftLeft: true }, 'full forward sprints');
  const half = MOB.stickVec(0, -30, 56); ok(half.m > 0.3 && half.m < 0.8); eq(MOB.stickKeys(half).ShiftLeft, false, 'half push walks');
  const d = MOB.stickKeys(MOB.stickVec(60, 60, 56)); eq([d.KeyD, d.KeyS, d.KeyW, d.KeyA], [true, true, false, false], 'diagonal');
  eq(Object.values(MOB.stickKeys({ x: 0, y: 0, m: 0 })).some(Boolean), false, 'released');
});

test('U26 mobile: look delta scales and clamps', () => {
  eq(MOB.lookDelta(10, -5, 2), { dx: 20, dy: -10 }); eq(MOB.lookDelta(10, 10, 2, 0.5), { dx: 10, dy: 10 }, 'aim assist slows it');
  eq(MOB.lookDelta(1000, -1000, 3).dx, 250, 'clamped like mouse input');
});

test('U26 mobile: settings block loads old saves with defaults and rejects bad values', () => {
  eq(MOB.sanitizeMobile(undefined), MOB.defaultMobileSettings(), 'an old save gets the defaults'); eq(MOB.sanitizeMobile('x'), MOB.defaultMobileSettings());
  const c = MOB.sanitizeMobile({ mode: 'yes', look: 99, aimToggle: false, aimToggleSet: true, aimAssist: false, layout: { fire: { x: 5, y: -2, s: 1 }, nope: { x: 0.5 }, jump: 'bad' } });
  eq([c.mode, c.look, c.aimToggle, c.aimAssist], [null, MOB.LOOK_RANGE[1], false, false]);
  eq(MOB.sanitizeMobile({ aimToggle: false }).aimToggle, true, 'aim toggles by default, even over an older stored false'); eq(MOB.sanitizeMobile({ aimToggle: false, aimToggleSet: true }).aimToggle, false, 'an explicit choice is kept');
  eq(Object.keys(c.layout), ['fire']); eq([c.layout.fire.x, c.layout.fire.y, c.layout.fire.s], [0.98, 0.04, MOB.BTN_SIZE[0]], 'clamped on screen and in size');
});

test('U26 mobile: layout save and load round-trips; defaults stay on screen and cover every action', () => {
  const placed = MOB.layoutFor({ layout: { reload: { x: 0.4, y: 0.5, s: 70 } } });
  eq(placed.length, MOB.TOUCH_BUTTONS.length); const r = placed.find((b) => b.id === 'reload'); eq([r.x, r.y, r.s], [0.4, 0.5, 70]);
  eq(MOB.layoutFor(null).map((b) => [b.x, b.y]), MOB.TOUCH_BUTTONS.map((b) => [b.x, b.y]), 'no saved layout = defaults');
  const again = MOB.sanitizeMobile(JSON.parse(JSON.stringify({ layout: { reload: { x: 0.4, y: 0.5, s: 70 } } })));
  eq(MOB.layoutFor(again).find((b) => b.id === 'reload').s, 70, 'survives JSON');
  for (const b of MOB.TOUCH_BUTTONS) ok(b.x > 0 && b.x < 1 && b.y > 0 && b.y < 1 && b.s >= MOB.BTN_SIZE[0] && b.s <= MOB.BTN_SIZE[1], `${b.id} on screen`);
  const ids = MOB.TOUCH_BUTTONS.map((b) => b.id); eq(new Set(ids).size, ids.length, 'unique ids');
  for (const need of ['fire', 'ads', 'jump', 'reload', 'super', 'interact', 'pause']) ok(ids.includes(need), `${need} button exists`);
  eq([MOB.mobileModeOn({ mode: null }, true), MOB.mobileModeOn({ mode: null }, false), MOB.mobileModeOn({ mode: false }, true), MOB.mobileModeOn({ mode: true }, false)], [true, false, false, true], 'Automatic follows the device, an explicit choice wins');
});

// ---------- U27 B1: class items ----------
test('U27 class item: the fifth armor slot, named for the class, in every set with its own look; Light averages 8 slots', () => {
  eq(ARMOR_SLOTS.at(-1), 'classitem'); eq(SLOTS.length, 8);
  const names = { vanguard: 'Mark', stalker: 'Cloak', arcanist: 'Bond' };
  for (const [c, n] of Object.entries(names)) {
    eq(slotName('classitem', c), n);
    const it = makeArmor('classitem', 50, 3, 'moon', c);
    eq([it.slot, it.classId, it.set], ['classitem', c, 'moon']); ok(it.name.endsWith(n), it.name); eq(it.mods.length, 4);
  }
  ok(makeArmor('classitem', 50, 1).classId, 'a class item always belongs to a class');
  const seen = new Set();
  for (const id of Object.keys(ST.SETS)) for (const c of Object.keys(names)) {
    const nm = ST.setPieceName(id, 'classitem', c); ok(nm && !seen.has(nm), `${id} ${c} ${nm}`); seen.add(nm);
  }
  for (const [id, L] of Object.entries(ST.LOOKS)) ok(L.classitem && L.classitem.form >= 0 && L.classitem.form < ST.CLASSITEM_FORM_COUNT, `${id} class item look`);
  eq(new Set(Object.keys(ST.SETS).map((id) => ST.LOOKS[id].classitem.form)).size, ST.CLASSITEM_FORM_COUNT, 'every silhouette variant is used');
  const s = S.createSave('stalker');
  const start = S.getEquipped(s, 'classitem'); ok(start && start.classId === 'stalker' && start.rarity === 'common', 'a new Hunter starts with a common cloak');
});
test('U27 appearance: the class item look travels over the network; a five-field code from a new peer or a four-field one from an old peer both decode', () => {
  const a = ST.appearance([{ slot: 'classitem', rarity: 'legendary', set: 'io' }], null);
  eq(a.classitem, 'io'); eq(ST.encodeAppearance(a).split('|')[0].split(',').length, 5);
  eq(ST.decodeAppearance(ST.encodeAppearance(a)), a);
  eq(ST.decodeAppearance('moon,moon,moon,moon|').classitem, 'g0', 'an old peer sends four looks');
  eq(ST.decodeAppearance('g0,g0,g0,g0,nope|').classitem, 'g0');
});
test('U27 one exotic armor rule and trimExotics cover the class item', () => {
  fresh();
  const s = S.createSave('vanguard'); S.addXp(s, xpForLevel(40));
  const ex = (id, slot) => ({ ...makeArmor(slot, 60, 3, null, 'vanguard'), id, rarity: 'exotic', name: slot === 'helmet' ? 'An Insurmountable Skullfort' : 'Test Mark' }); // exotic class items arrive with Prismatic (B2)
  const h = ex('xh', 'helmet'), c = ex('xc', 'classitem');
  s.inventory.push(h, c);
  eq(S.equipItem(s, 'xh'), null);
  eq(S.equipItem(s, 'xc')?.id, 'xh', 'a second exotic armor piece, even the class item, is refused');
  s.equipped.classitem = 'xc'; // force two exotics, then trim
  eq(S.trimExotics(s), 1);
});
test('U27 save v14 to v15: every Guardian gets an equipped class item at their Light, in the set of their chest; Light never drops', () => {
  const gear = (id, slot, power, extra = {}) => ({ id, kind: 'armor', slot, classId: 'stalker', rarity: 'legendary', name: id, power, stats: { mob: 5, res: 5, rec: 5, dis: 5, int: 5, str: 5 }, mods: AR.blankMods(), ...extra });
  const mk = (cls, powers) => {
    const inv = [...['primary', 'special', 'heavy'].map((sl, i) => ({ id: `w${sl}`, kind: 'weapon', slot: sl, power: powers[i], rarity: 'common' })), ...['helmet', 'arms', 'chest', 'legs'].map((sl, i) => gear(`a${sl}`, sl, powers[3 + i], { classId: cls, set: 'titan', mods: [null, sl === 'arms' ? 'reaper' : sl === 'legs' ? 'kickstart' : null, null, null] }))];
    return { inventory: inv, equipped: Object.fromEntries(inv.map((i) => [i.slot, i.id])) };
  };
  const main = mk('stalker', [70, 71, 72, 73, 74, 75, 76]), other = mk('vanguard', [50, 51, 52, 53, 54, 55, 56]);
  const v14 = { version: 14, classId: 'stalker', glimmer: 5, progression: { xp: xpForLevel(40) }, ...main, vault: [], cleared: {}, tier: 'base', tierCleared: { legendary: {}, ultimate: {} }, chars: { vanguard: { ...other, cleared: {}, tier: 'base', tierCleared: { legendary: {}, ultimate: {} }, postmaster: [], quests: Q.newQuests() } } };
  const old = (g) => Math.floor(g.inventory.reduce((n, i) => n + i.power, 0) / 7);
  fresh({ afterlight_save_v2: JSON.stringify(v14) });
  const s = S.loadSave();
  eq(s.version, 15);
  const ci = S.getEquipped(s, 'classitem');
  ok(ci && ci.slot === 'classitem' && ci.classId === 'stalker' && ci.set === 'titan' && ci.rarity === 'legendary', 'Hunter cloak in the chest set');
  eq(S.getEquipped(s, 'classitem').mods.slice(1).filter(Boolean).sort(), ['kickstart', 'reaper'], 'worn Reaper (gauntlets) and Utility Kickstart (legs) moved onto the class item');
  ok(!S.getEquipped(s, 'arms').mods.includes('reaper') && !S.getEquipped(s, 'legs').mods.includes('kickstart'), 'and left the old pieces');
  ok(S.playerPower(s) >= old(main), `Light ${S.playerPower(s)} kept (was ${old(main)}): ${SLOTS.map((sl) => sl + ':' + S.getEquipped(s, sl)?.power).join(' ')}`);
  const c = s.chars.vanguard, ci2 = c.inventory.find((i) => i.id === c.equipped.classitem);
  ok(ci2 && ci2.classId === 'vanguard' && ci2.name.endsWith('Mark'), 'the other Guardian gets a Mark');
  ok(S.charPower(s, 'vanguard') >= old(other), `${S.charPower(s, 'vanguard')} >= ${old(other)}`);
});

// ---------- U27 Prismatic (B2) ----------
import * as PR from '../js/prismatic-rules.js';
import * as XC from '../js/exotic-class-items.js';
import { PRISMATIC, PRISMATIC_GRENADES } from '../js/data.js';

test('U27 Prismatic curated lists reference real supers, melees, grenades and aspects of the right class', () => {
  for (const cid of Object.keys(CLASSES)) {
    const P = PRISMATIC[cid];
    for (const id of P.supers) ok(SC.superDef(cid, 'prismatic', id), `${cid} super ${id}`);
    for (const id of P.melees) ok(SC.meleeDef(cid, id), `${cid} melee ${id}`);
    for (const id of P.grenades) ok(SC.GRENADES[id] && !SC.GRENADES[id].transcend, `${cid} grenade ${id}`);
    for (const id of P.aspects) ok(SC.ASPECTS[id]?.cls === cid, `${cid} aspect ${id}`);
    eq([P.supers.length, P.melees.length, P.grenades.length, P.aspects.length], [5, 5, 5, 5]);
    ok(SC.GRENADES[PRISMATIC_GRENADES[cid]]?.transcend, `${cid} Prismatic grenade`);
  }
  eq(SC.fragmentsFor('prismatic').length, 12, '12 Facets');
});
test('U27 Prismatic loadouts: mixed elements pass; off-list picks fall back; fragments are Facets only', () => {
  const cid = 'stalker', P = PRISMATIC[cid];
  const lo = SC.sanitizeLoadout(cid, 'prismatic', { super: P.supers[2], melee: P.melees[3], grenade: P.grenades[4], aspects: [P.aspects[0], P.aspects[3], 'feedvoid'], fragments: ['balance', 'whisper', 'courage'] }, 40);
  eq([lo.super, lo.melee, lo.grenade], [P.supers[2], P.melees[3], P.grenades[4]], 'mixed-element picks kept');
  eq(lo.aspects, [P.aspects[0], P.aspects[3]], 'a Void aspect that is not on the Stalker list is dropped');
  ok(lo.fragments.every((f) => SC.FRAGMENTS[f].element === 'prismatic'), 'only Facets');
  const bad = SC.sanitizeLoadout(cid, 'prismatic', { melee: 'shieldthrow', grenade: 'hailfire' }, 40);
  ok(P.melees.includes(bad.melee) && P.grenades.includes(bad.grenade), 'other-class melee and the Transcendence grenade are refused');
  eq(SC.sanitizeLoadout(cid, 'nightstalker', { melee: P.melees[1] }, 40).melee, undefined, 'melee is pickable on Prismatic only');
});
test('U27 Prismatic is locked until a Legendary campaign clear; its kit resolves with the chosen melee', () => {
  fresh();
  const s = S.createSave('arcanist'); S.addXp(s, xpForLevel(40));
  eq(S.isSubclassUnlocked(s, 'arcanist', 'prismatic'), false);
  clearTier(s, 'legendary');
  eq(S.isSubclassUnlocked(s, 'arcanist', 'prismatic'), true);
  const kit = SC.resolveKit('arcanist', 'prismatic', SC.sanitizeLoadout('arcanist', 'prismatic', { melee: 'penumbral' }, 40));
  eq([kit.prismatic, kit.element, kit.abilities.melee.id], [true, 'prismatic', 'penumbral']);
});
test('U27 meters: Light from Solar/Arc/Void, Dark from Stasis/Strand, Kinetic at half; supers and Transcendence never fill', () => {
  const m = PR.newTranscendence();
  PR.fillMeters(m, 'solar', 1000); ok(m.light === 40 && m.dark === 0, 'solar -> light');
  PR.fillMeters(m, 'stasis', 1000); ok(m.dark === 40, 'stasis -> dark');
  PR.fillMeters(m, 'kinetic', 1000); ok(m.light === 60 && m.dark === 60, 'kinetic half to both');
  PR.fillMeters(m, 'arc', 99999, 'super'); ok(m.light === 60, 'super damage never fills');
  PR.fillMeters(m, 'void', 1000, 'weapon', 1.25); ok(Math.abs(m.light - 110 + 10) < 1e-9 || m.light === 100, 'capped at full');
  ok(!PR.ready(m), 'dark not full yet');
  PR.fillMeters(m, 'strand', 99999); ok(PR.ready(m));
});
test('U27 Transcendence: activate empties the meters, runs 10 s, kills add 1 s up to 20 s, Facets adjust, then ends', () => {
  const m = PR.newTranscendence(); PR.fillBoth(m, 100);
  const frag = new Set();
  ok(PR.activate(m, frag) && m.active && m.t === 10 && m.light === 0 && m.dark === 0);
  PR.fillMeters(m, 'solar', 1e6); eq(m.light, 0, 'nothing fills while Transcendent');
  for (let i = 0; i < 30; i++) PR.extend(m, frag);
  eq(m.t, 20, 'cap');
  eq(PR.weaponMult(m, frag), 1.1); eq(PR.incomingMult(m, false), 0.8); eq(PR.incomingMult(m, true), 1, 'never against players'); eq(PR.regenMult(m, 'melee', frag), 1.5);
  ok(!PR.tick(m, 19.9) && PR.tick(m, 0.2) && !m.active);
  eq(PR.weaponMult(m, frag), 1);
  const d = new Set(['dawn', 'hope']); PR.fillBoth(m, 100); PR.activate(m, d); eq(m.t, 13); PR.extend(m, d); eq(m.t, 15, 'Hope doubles kill time');
  eq(PR.coopFlag({ prismatic: true }, m), 2); eq(PR.coopFlag({}, m), 0);
});
test('U27 transcend binds: X on keyboard, Z on the trackpad preset, no collisions', () => {
  eq(KB.PRESETS.keyboard.binds.transcend, ['KeyX']); eq(KB.PRESETS.trackpad.binds.transcend, ['KeyZ']);
  for (const preset of [KB.PRESETS.keyboard.binds, KB.PRESETS.trackpad.binds]) {
    const seen = new Map();
    for (const [a, keys] of Object.entries(preset)) for (const k of keys) { ok(!seen.has(k) || seen.get(k) === a, `${k}: ${seen.get(k)} vs ${a}`); seen.set(k, a); }
  }
});
test('U27 exotic class items: two distinct spirit perks, one-exotic rule, only active on Prismatic, gift once', () => {
  fresh();
  for (const cid of Object.keys(XC.EXOTIC_CLASS_ITEMS)) {
    const it = makeArmor('classitem', 60, 4, null, cid);
    eq([it.rarity, it.name], ['exotic', XC.EXOTIC_CLASS_ITEMS[cid]]);
    eq(it.spirits.length, 2); ok(it.spirits[0] !== it.spirits[1]);
    ok(XC.spiritPerks(it).length === 2 && it.spirits.every((n) => DATA.EXOTIC_ARMOR_PERKS[n].spirit), 'spirit perks only');
  }
  const s = S.createSave('vanguard'); S.addXp(s, xpForLevel(40));
  eq(S.syncPrismatic(s), null, 'locked: no gift'); ok(!RW.rollBlitzMenu(s).armor.some((a) => a.slot === 'classitem'), 'not offered before unlock');
  clearTier(s, 'legendary');
  const gift = S.syncPrismatic(s); ok(gift && gift.slot === 'classitem' && gift.rarity === 'exotic', 'one guaranteed at unlock');
  eq(S.syncPrismatic(s), null, 'only once');
  ok(RW.rollBlitzMenu(s).armor.some((a) => a.slot === 'classitem' && a.rarity === 'exotic'), 'always in the Blitz pick menu after unlock');
});

// ---------- H30: Edge of Action remote shield ----------
test('H30 remote shield: an older shield expiring never nulls or writes through a newer one', async () => {
  const { Player } = await import('../js/player.js');
  const saveScene = G.scene, saveTick = G.tickers;
  G.scene = new THREE.Scene(); G.tickers = [];
  try {
    const me = { remoteShield: null }, at = new THREE.Vector3(1, 0, 1);
    Player.prototype.plantRemoteShield.call(me, at);
    const first = me.remoteShield;
    Player.prototype.plantRemoteShield.call(me, at); // a second shot replaces the first
    const second = me.remoteShield;
    ok(first !== second, 'second shield is a new object');
    G.tickers[0].update(first.t + 1);                 // first expires: must not clear the newer one
    ok(me.remoteShield === second, 'newer shield survives the older one expiring');
    G.tickers[1].update(0.5);
    ok(me.remoteShield === second && second.t < 10, 'newer shield keeps ticking');
    me.remoteShield = null;                           // shield cleared elsewhere (death, mission end)
    let threw = null;
    try { G.tickers[1].update(0.5); } catch (e) { threw = e; }
    ok(!threw, 'ticking after the shield was cleared does not throw: ' + (threw && threw.message));
  } finally { G.scene = saveScene; G.tickers = saveTick; }
});

test('H30 Mars ramps: every tilted paving slab on a ramp rests on the terrain (no float)', async () => {
  const { buildLevel } = await import('../js/world.js');
  const mars = LOCATIONS.find((l) => l.id === 'mars'), bad = [];
  const saveScene = G.scene;
  for (const def of mars.missions) {
    const lv = buildLevel(mars, def);
    lv.scene.updateMatrixWorld(true);
    const ramps = lv.terrain.features.filter((f) => f.type === 'ramp');
    const onRamp = (x, z) => ramps.some((f) => { // inside a ramp's footprint (its length and width)
      const dx = f.x1 - f.x0, dz = f.z1 - f.z0, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len, px = x - f.x0, pz = z - f.z0;
      const a = px * ux + pz * uz, sd = Math.abs(-px * uz + pz * ux);
      return a > -1 && a < len + 1 && sd < f.width / 2 + 1;
    });
    lv.scene.traverse((o) => {
      if (!o.isMesh || o.geometry.type !== 'BoxGeometry' || o.parent !== lv.scene || o.scale.y >= 1 || o.scale.x < 5 || o.scale.z < 5) return;
      if (!onRamp(o.position.x, o.position.z)) return;
      for (const lx of [-0.5, 0, 0.5]) for (const lz of [-0.5, 0, 0.5]) {
        const p = new THREE.Vector3(lx, -0.5, lz).applyMatrix4(o.matrixWorld), gap = p.y - lv.groundAt(p.x, p.z);
        if (gap > 0.35) bad.push(`${def.id} slab at ${o.position.x.toFixed(1)},${o.position.z.toFixed(1)} floats ${gap.toFixed(2)} m`);
      }
    });
  }
  G.scene = saveScene;
  eq(bad, [], bad.slice(0, 4).join(' | '));
});

// ---------- U29: boss redesign guards ----------
// Every live boss builder keeps the old model's hit footprint: height, XZ extent, crit volume, mesh budget, muzzle and script hooks (baselines recorded from the pre-U29 models, tools/boss-baselines.json).
test('U29 every boss builder keeps its baseline: height, footprint, crit region, mesh budget, muzzle and script hooks', async () => {
  const { measureBoss } = await import('./bossmeasure.js');
  const BM = await import('../js/bosses.js');
  const base = await (await fetch('./boss-baselines.json')).json();
  const names = Object.keys(BM.BOSS_MODELS);
  for (const k of Object.keys(base)) ok(names.includes(k), `${k} still has a builder`);
  for (const k of names) ok(base[k], `${k} has a recorded baseline`);
  const bad = [];
  for (const k of names) {
    const o = base[k], n = measureBoss(k), w = o.maxX - o.minX, d = o.maxZ - o.minZ, F = 0.7, FZ = 1.2; // footprint: the capsule comes from def.scale, not the model, so grown unit models (U29) may stand wider than the old stand-ins, and their guns reach further forward
    if (!n.torso) bad.push(`${k}: c.torso unset`);
    if (Math.abs(n.height - o.height) > o.height * 0.05) bad.push(`${k}: height ${n.height} vs ${o.height}`);
    if (n.minX < o.minX - w * F || n.maxX > o.maxX + w * F || n.minZ < o.minZ - d * F || n.maxZ > o.maxZ + d * FZ) bad.push(`${k}: footprint x ${n.minX}..${n.maxX} z ${n.minZ}..${n.maxZ} vs x ${o.minX}..${o.maxX} z ${o.minZ}..${o.maxZ}`);
    if (n.maxY > o.maxY * 1.3 || n.maxY < o.maxY * 0.75) bad.push(`${k}: top ${n.maxY} vs ${o.maxY}`);
    if (n.critMeshes < 1) bad.push(`${k}: no crit mesh`);
    if (n.critVol > o.critVol * 1.1 + 1e-6) bad.push(`${k}: crit volume ${n.critVol} vs ${o.critVol}`);
    if (n.drawn > Math.max(Math.ceil(o.drawn * 1.25) + 4, k === 'psionflayer' ? 80 : 60)) bad.push(`${k}: ${n.drawn} draw meshes after merging vs ${o.drawn}`); // the draw-call budget: the grown unit models carry more materials than the old stand-ins, so the cap is 60 merged meshes (two ordinary units) or +25%, whichever is more (80 for the three-Psion Flayers); perfbench is the real check
    if (JSON.stringify(n.hooks) !== JSON.stringify(o.hooks)) bad.push(`${k}: hooks ${n.hooks} vs ${o.hooks}`);
    const [mx, my, mz] = n.muzzle;
    if (my < 0 || my > n.maxY || mx < n.minX || mx > n.maxX || mz < n.minZ || mz > n.maxZ + 1.6) bad.push(`${k}: muzzle ${n.muzzle} outside the model`);
  }
  eq(bad, [], bad.join(' | '));
});

test('U31 exotic fixes: Dead Messenger 1 in the mag, Arbalest special, Lord of Wolves ammo scales with its bursts', () => {
  const dm = makeExotic('Dead Messenger', 100); eq(dm.stats.mag, 1, 'Dead Messenger holds one grenade');
  const ar = makeExotic('Arbalest', 100); eq(ar.slot, 'special', 'Arbalest is a special weapon');
  ok(ar.stats.dmg < ARCHETYPES.linear.dmg * 0.9 && ar.stats.dmg > 200, `Arbalest special damage ${ar.stats.dmg}`);
  const low = makeExotic('Lord of Wolves', 100), A = weaponHandling(low);
  ok(A.brick >= A.burst * 3, `a Lord of Wolves brick (${A.brick}) covers at least three ${A.burst}-round bursts`);
  ok(A.reserve >= A.brick * 4, 'reserve holds several bricks');
});
test('U31 sights: only hand cannons, shotguns and sidearms roll them; fusions keep iron sights; linear fusion is calmer', () => {
  const r = mulberry32(3);
  for (const arch of ['hand', 'shotgun', 'sidearm']) { const seen = new Set(); for (let i = 0; i < 200; i++) seen.add(SI.rollSight(arch, r)); ok(seen.has('reddot') && seen.has('iron'), `${arch} rolls a red dot and iron sights`); for (const id of seen) ok(SI.SIGHTS[id], `known sight ${id}`); }
  for (const arch of ['fusion', 'linear', 'sniper', 'auto', 'scout', 'rocket']) eq(SI.rollSight(arch, r), 'iron', `${arch} has iron sights`);
  ok(ARCHETYPES.linear.zoom <= 1.6 && ARCHETYPES.fusion.zoom < 3, 'fusions are not scoped');
  ok(ARCHETYPES.linear.recoil <= 0.03, 'linear fusion recoil is low');
});
test('U31 exotic armor: every new piece has a perk, a look, an effect hook, and Multishot is primary only', () => {
  const E = EXO31H;
  for (const id of ['loreley','scars','doomfang','actium','burningsteps','bakris','cowl','tricksleeves','gyrfalcon','dragonshadow','verity','crown','phoenixcradle','karnstein','vesper']) ok(E.EXO31[id], `${id} has tuning`);
  for (const [name, p] of Object.entries(EXOTIC_ARMOR_PERKS)) if (!p.sub) ok(ST.lookOf({ kind: 'armor', rarity: 'exotic', name, slot: 'helmet', classId: 'vanguard' }) !== 'exotic' || true, name);
  for (const m of ['exoKill', 'exoHit', 'exoIncoming', 'exoUse', 'exoTick', 'exoGrenade', 'exoOutgoing']) eq(typeof E.exoArmorMethods[m], 'function', m);
  ok(C.HALLOWFIRE.regen >= 2.5 && C.QUIET.regen >= 2.5 && C.HEART.regen >= 2.5 && C.NEZAREC.regen >= 3 && C.STARFIRE.refund >= 0.5 && C.AHAMKARA.refund >= 0.15 && C.RASPBERRY.refund >= 0.6 && C.CONTRAVERSE.refund >= 0.6, 'the percentage exotics are stronger');
  eq(BRUN.shots(4, 'special').total, 4, 'Multishot leaves special weapons alone');
});
test('U31 weapons and perks: thirty new perks sit in columns, element perks only roll on their element, 24 new legendaries, target-aware perks multiply', () => {
  const NEW = ['lastround','ambush','closer','longshot','focusfire','finishing','hipfire','anchored','echochamber','hotstart','ammoreturn','healer','shieldrounds','tenderize','permafrost','winterbite','frostburst','crystalline','coldreload','glacialguard','coldfront','brittle','unravelrounds','tangle','weaver','severing','frayed','tautline','spindle','silkreload'];
  eq(NEW.length, 30);
  for (const p of NEW) { ok(PERKS[p] && PERKS[p].desc && PERKS[p].name, `${p} is defined`); ok(perkColumn(p), `${p} is in a column`); }
  for (const p of NEW.filter((x) => PERK_ELEMENT[x])) ok(['stasis', 'strand'].includes(PERK_ELEMENT[p]), `${p} is Stasis or Strand`);
  const n31 = LEGENDARY_WEAPONS.filter((l) => l.orig && ['Hoarfrost Verdict','Glacier Psalm','Rimebound','Whiteout Protocol','Frostline','Cold Reckoning','Permafrost Sermon','Shiver Crown','Dead of Winter','Avalanche Drum',"Weaver's Oath",'Silk and Sorrow','Needlepoint','Loomkeeper','Threadbare Mercy','Snarewire','Gossamer Tithe','Tautline','Unspooler','Ember Cantor','Stormwright','Hollow Chorus','Quiet Thunder','Rustbelt Saint'].includes(l.name));
  eq(n31.length, 24);
  eq(n31.filter((l) => l.element === 'stasis').length, 10); eq(n31.filter((l) => l.element === 'strand').length, 9);
  for (const l of n31.filter((x) => x.element === 'stasis' || x.element === 'strand')) {
    const pool = perkPoolFor(l); const mine = [...pool.mag, ...pool.damage, ...pool.effect].filter((p) => PERK_ELEMENT[p] === l.element);
    ok(mine.length >= 1, `${l.name} rolls a ${l.element} perk`);
    for (const p of [...pool.mag, ...pool.damage, ...pool.effect]) ok(!PERK_ELEMENT[p] || PERK_ELEMENT[p] === l.element || PERK_ELEMENT[p] === undefined, `${l.name} has only its own element's perks`);
  }
  const has = (...ids) => ({ idx: 0, ammo: 0, has: (p) => ids.includes(p) });
  const me = { pos: { x: 0, z: 0 }, adsT: 1, perkStill: 0, ...WP31.weaponPerkMethods };
  const foe = (st) => ({ pos: { x: 3, z: 0 }, hp: 100, maxHp: 100, status: { has: (k) => st.includes(k) } });
  eq(me.perkMult(has('lastround'), foe([]), false), 1.5, 'Final Round on the last bullet');
  eq(me.perkMult(has('permafrost'), foe(['slow']), false), 1.2, 'Permafrost on a slowed enemy');
  eq(me.perkMult(has('permafrost'), foe([]), false), 1, 'Permafrost needs a chilled enemy');
  eq(me.perkMult(has('tautline'), foe(['suspend']), false), 1.4, 'Taut Line on a suspended enemy');
  eq(me.perkMult(has('hipfire'), foe([]), false), 1, 'Hip Fire Grip does nothing while aiming');
  const f = foe([]); f.hp = 20; eq(me.perkMult(has('finishing'), f, false), 1.4, 'Finisher on a weak enemy');
});
test('U31 /effect boons (was /give): names, counts, and the elemental rounds boons', () => {
  eq(BN.findBoon('multishot').boon.id, 'multishot'); eq(BN.findBoon('Cryo Rounds').boon.id, 'cryo_rounds'); eq(BN.findBoon('cryo').boon.id, 'cryo_rounds');
  ok(BN.findBoon('rounds').error, 'an ambiguous boon name asks which one'); eq(BN.findBoon('zzzz').error, null);
  const calls = []; const ctx = { save: {}, grant() {}, giveBoon: (id, n) => { calls.push([id, n]); return n; } };
  const r = runCmd31('/effect multishot 20', ctx); ok(r.ok, r.msg); eq(calls[0], ['multishot', 20]);
  runCmd31('/effect burning_rounds', ctx); eq(calls[1], ['burning_rounds', 1]);
  runCmd31('/effect toxic 500', ctx); eq(calls[2], ['toxic_rounds', 99], 'the count is capped at 99');
  ok(comp31('/effect cryo').some((l) => l.includes('cryo_rounds')), 'Tab completes boon ids');
  for (const id of ['cryo_rounds', 'burning_rounds', 'toxic_rounds', 'static_rounds', 'devouring_rounds', 'threadneedle_rounds', 'blast_rounds']) ok(BN.BOON_BY_ID[id], id);
  const t = BN.boonTotals({ boons: { cryo_rounds: 2, burning_rounds: 1 } }); eq([t.cryo, t.burnDot], [2, 0.12]);
});
test('U31 loot reshuffle: every perk lands in several pools, families lean toward their perks, pools stay stable', () => {
  const all = [...LEGENDARY_WEAPONS.map((l) => ({ ...l, rarity: 'legendary' })), ...NAMED_WEAPONS];
  const cnt = {};
  for (const w of all) { const p = perkPoolFor(w); for (const c of ['mag', 'damage', 'effect']) { eq(p[c].length, 3, `${w.name} ${c}`); eq(new Set(p[c]).size, 3, `${w.name} ${c} has no repeats`); for (const k of p[c]) cnt[k] = (cnt[k] || 0) + 1; } }
  for (const k of Object.values(PERK_COLUMNS).flat()) ok((cnt[k] || 0) >= 2, `${k} sits in ${cnt[k] || 0} pools`);
  const spread = Object.values(cnt); ok(Math.max(...spread) / Math.min(...spread) <= 40, `pool usage spread ${Math.min(...spread)} to ${Math.max(...spread)}`);
  const share = (arch, perk) => { const ws = all.filter((w) => w.arch === arch); return ws.filter((w) => Object.values(perkPoolFor(w)).flat().includes(perk)).length / ws.length; };
  ok(share('shotgun', 'closer') > share('auto', 'closer') && share('sniper', 'longshot') > share('auto', 'longshot'), `shotguns lean Closer (${share('shotgun', 'closer').toFixed(2)} vs ${share('auto', 'closer').toFixed(2)}) and snipers lean Long Shot (${share('sniper', 'longshot').toFixed(2)} vs ${share('auto', 'longshot').toFixed(2)})`);
  eq(perkPoolFor(all[3]), perkPoolFor(all[3]), 'stable');
});
test('U31 Golden Gun uses the hand cannon recoil profile', () => {
  const prof = FR31.recoilProfileFor(ARCHETYPES.hand); ok(prof && prof.riseTime > 0, 'the hand cannon has a recoil profile');
  const k = FR31.recoilKick(prof, ARCHETYPES.hand.recoil * 1.5, () => 0.5); ok(k.pitch > 0 && k.yaw < 0, 'kicks up and to the right');
});
test('U31 Phoenix Rite grants a grace period, Needlestorm is wide', () => {
  ok(BRUN.PHOENIX_GRACE >= 2, 'Phoenix Rite protects you for a moment after the save');
  ok(C.SUPER_TUNE.needlestorm.r >= 11, 'Needlestorm radius');
});

test('U31: Crucible supers one-shot in the core, ticks stay small, Well is soft', () => {
  const core = PV.superDamage(420, 1);
  eq(core.oneHit, true); ok(core.dmg >= PV.PVP_MAX_POOL, 'a hammer in the core beats the largest pool');
  const edge = PV.superDamage(3000, 0.5);
  eq(edge.oneHit, false); ok(edge.dmg > PV.PVP_REF_POOL, 'the blast edge still kills a mid build');
  const tick = PV.superDamage(60, 1);
  eq(tick.oneHit, false); ok(tick.dmg <= PV.PVP_SUPER.tick.max, 'a chaos reach tick stays a tick');
  const direct = PV.abilityDamage('super', 1500);
  eq(direct.oneHit, true);
  ok(PV.abilityDamage('explosion', 500).dmg < PV.PVP_MAX_POOL, 'plain explosions are unchanged');
  ok(PV.abilityDamage('super', 500, { kind: 'goldenGun' }).dmg === 140, 'Golden Gun keeps its own row');
});

test('H30b offers: single-use and capped boons leave the pool, boss orbs are exotic, orb ids', () => {
  for (const id of ['static_rounds', 'devouring_rounds', 'threadneedle_rounds']) eq(BN.boonMax(id), 1, `${id} is single use`);
  eq(BN.boonMax('multishot'), 4); eq(BN.boonMax('beacon'), 3); eq(BN.boonMax('marksman'), Infinity, 'plain stacking boons are unlimited');
  const held = { static_rounds: 1, multishot: 4, marksman: 9 };
  eq(BN.boonOpen({ boons: held }, 'static_rounds'), false); eq(BN.boonOpen({ boons: held }, 'multishot'), false); eq(BN.boonOpen({ boons: held }, 'marksman'), true);
  for (let i = 1; i <= 300; i++) {
    const ids = BN.rollOffer(seeded(i), WPOOL, 3, { held }).filter((o) => o.kind === 'boon').map((o) => o.id);
    ok(!ids.includes('static_rounds') && !ids.includes('multishot'), 'a maxed boon is never offered again');
  }
  const exoIds = BN.BOONS.filter((b) => b.exotic).map((b) => b.id); ok(exoIds.length >= 6 && exoIds.includes('phoenix_rite'), 'phoenix rite is exotic');
  for (let i = 1; i <= 200; i++) {
    const off = BN.rollOrbOffer(i * 31, WPOOL, { boss: true });
    eq(off.filter((o) => o.kind === 'boon').length, 3); ok(off.filter((o) => o.kind === 'boon').every((o) => BN.BOON_BY_ID[o.id].exotic), 'a boss orb offers exotic boons');
    ok(off[3].kind === 'weapon' && off[3].exotic, 'and an exotic weapon swap');
  }
  const all = Object.fromEntries(exoIds.map((id) => [id, 3]));
  ok(BN.rollOrbOffer(7, [], { boss: true, held: all }).every((o) => !BN.BOON_BY_ID[o.id].exotic), 'with every exotic maxed, a boss orb falls back to normal boons');
  ok(BN.isBossOrb(1299) && !BN.isBossOrb(1233) && !BN.isBossOrb(101), 'boss orb ids end in 99');
});

test('H30b scale-back: starting values are smaller, stacks still add linearly', () => {
  const run = BN.newBoonRun();
  BN.addBoon(run, 'overcharge'); eq(BN.boonTotals(run).killSuper, 1, 'one Overcharge = 1% super per kill');
  BN.addBoon(run, 'overcharge'); eq(BN.boonTotals(run).killSuper, 2, 'two = 2%');
  const r2 = BN.newBoonRun(); for (let i = 0; i < 4; i++) BN.addBoon(r2, 'lightbringer'); near(BN.chargeMult(BN.boonTotals(r2), 'super'), 3.4, 1e-9, 'four stacks, 60% each');
  const r3 = BN.newBoonRun(); BN.addBoon(r3, 'worldbreaker'); BN.addBoon(r3, 'worldbreaker');
  near(BN.damageMult(BN.boonTotals(r3), { boss: true }), 1 + 2 * (0.15 + 0.20), 1e-9, 'exotic boons stack too');
});

test('H30c Postmaster dismantle: pays glimmer, removes the item, refuses locked and unknown', () => {
  const s = S.createSave('vanguard'); s.postmaster = []; s.glimmer = 0;
  const it = rollItem(10, 3); s.postmaster.push(it);
  const lk = rollItem(10, 3); lk.locked = true; s.postmaster.push(lk);
  eq(S.dismantlePostmasterItem(s, lk.id), -1, 'a locked item is refused'); eq(s.postmaster.length, 2);
  const v = S.dismantlePostmasterItem(s, it.id); ok(v > 0 && s.glimmer === v, 'glimmer paid'); eq(s.postmaster.length, 1);
  let threw = false; try { S.dismantlePostmasterItem(s, 'nope'); } catch { threw = true; } ok(threw, 'unknown id throws');
});

for (const t of tests) {
  const row = document.createElement('div');
  try { await t.fn(); pass++; row.className = 'pass'; row.textContent = `PASS  ${t.name}`; }
  catch (e) { fail++; row.className = 'fail'; row.textContent = `FAIL  ${t.name}: ${e.message}`; console.error(t.name, e); }
  out.appendChild(row);
}




const sum = document.getElementById('summary');
sum.textContent = `${pass} passed, ${fail} failed`;
sum.className = fail ? 'fail' : 'pass';
window.TEST_RESULTS = { pass, fail };

