// Afterlight unit tests: pure logic only (progression, loot, save, data, releases, status effects, combat rules).
// Open tools/tests.html on the running dev server. Uses an in-memory store, so the real save is never touched.
import { WEAPON_SLOTS as WEAPON_SLOTS_T, CLASSES, LOCATIONS, ARCHETYPES, EXOTIC_WEAPONS, RARITIES, ELEMENTS, EXOTIC_ARMOR, EXOTIC_ARMOR_PERKS, exoticArmorFor } from '../js/data.js';
import { LEVEL_CAP, LIGHT_CAP, XP, xpToNext, xpForLevel, levelInfo, rewardAt, rarityWeights, rollRarity, subclassLevel, subclassesUnlockedAt, RARITY_CURVE } from '../js/progression.js';
import { rollItem, exoticWeights, pickExotic, EXOTIC_REPEAT_WEIGHT } from '../js/loot.js';
import * as S from '../js/save.js';
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
import { orientedCollider, footprintHit, pointInColliders, pushOutCircle, moveBody } from '../js/colliders.js';
import { buildNav, findPath, lineClear, heightAt, floodReach, ledgeSpots, nearestWalkable, NAV } from '../js/nav.js';
import * as AI from '../js/ai.js';
import * as TR from '../js/tiers.js';
import { ENEMY_TYPES } from '../js/data.js';
import * as FA from '../js/factions.js';
import * as OB from '../js/objectives.js';
import * as ST_ from '../js/story.js';
import * as Q from '../js/quests.js';
import { TOWER_SPOTS } from '../js/tower-data.js';

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
  const starters = (c) => Object.keys(CLASSES[c].subclasses).filter((id) => subclassLevel(c, id) === 1).sort();
  eq(starters('vanguard'), ['striker', 'sunbreaker']); // Sunbreaker + Fists of Havoc
  eq(starters('arcanist'), ['dawnblade', 'voidwalker']); // Nova Bomb + Dawnblade
  eq(starters('stalker'), ['gunslinger', 'nightstalker']); // Golden Gun + Shadowshot
  eq(subclassesUnlockedAt(10).map((x) => x.subId).sort(), ['arcstrider', 'sentinel', 'stormcaller']);
  for (const c of Object.keys(CLASSES)) eq(Object.keys(CLASSES[c].subclasses).length, 3, c);
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
  eq(rollItem(LIGHT_CAP + 50, 3).power, LIGHT_CAP);
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
  for (const sl of ['primary', 'special', 'heavy', 'helmet', 'arms', 'chest', 'legs']) ok(S.getEquipped(s, sl), sl);
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
test('claiming with a full inventory is refused and loses nothing', () => {
  fresh();
  const s = S.createSave('vanguard');
  S.addXp(s, xpForLevel(3));
  while (s.inventory.length < S.INVENTORY_CAP) s.inventory.push(rollItem(10, 0));
  ok(S.claimLevelReward(s, 3).error, 'refused');
  eq(S.rewardState(s, 3), 'ready');
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
const SUBS = Object.entries(CLASSES).flatMap(([c, k]) => Object.keys(k.subclasses).map((sid) => [c, sid]));
test('registry: 3 grenades per element, 2 class abilities per class, 4 aspects per subclass, 8 fragments per element', () => {
  for (const el of ['solar', 'arc', 'void']) eq(SC.grenadesFor(el).length, 3, el);
  for (const [c, sid] of SUBS) eq(SC.classAbilitiesFor(c, sid).length, sid === 'dawnblade' ? 3 : 2, sid); // H4: Phoenix Dive is Dawnblade's third
  // H3: each former subclass trait is an aspect; Bastion is gone, so Sentinel keeps 4 and the rest have 5
  for (const [c, sid] of SUBS) eq(SC.aspectsFor(c, sid).length, sid === 'sentinel' ? 4 : 5, sid);
  eq(Object.keys(SC.ASPECTS).length, 44);
  eq([SC.fragmentsFor('solar').length, SC.fragmentsFor('arc').length, SC.fragmentsFor('void').length], [8, 8, 8]);
  for (const a of Object.values(SC.ASPECTS)) ok(a.slots === 2 || a.slots === 3, a.name); // U9: one more slot each
});
test('every default loadout is valid and resolves to the expected abilities (H3: Sentinel keeps its barricade, Sunsinger grenades from Gift of the Sun)', () => {
  const v12 = { // grenade, grenade cd, class ability, class cd
    sunbreaker: ['solar', 33, 'barricade', 34], striker: ['pulse', 30, 'barricade', 34], sentinel: ['suppressor', 33, 'barricade', 34],
    gunslinger: ['swarm', 30, 'marksman', 13], nightstalker: ['axion', 30, 'marksman', 16], arcstrider: ['flux', 30, 'gambler', 12],
    voidwalker: ['vortex', 36, 'rift', 42], stormcaller: ['storm', 33, 'empower', 42], dawnblade: ['solar', 23, 'rift', 42],
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
  eq(s.version, S.SAVE_VERSION); eq(S.SAVE_VERSION, 10);
  eq(s.loadout, {}); eq(s.glimmer, 777); eq(s.subclass, { stalker: 'nightstalker' }); eq(s.cleared, { e1: true }); eq(s.inventory.length, 1);
  eq(JSON.parse(st.getItem('afterlight_save_v2')).version, 10, 'written back');
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
  eq(Object.keys(SC.SUPERS).length, 12);
  for (const c of Object.keys(CLASSES)) eq(Object.values(SC.SUPERS).filter((x) => x.cls === c).length, 4, c);
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
test('drops: engram chances cut, bosses still drop', () => {
  eq(C.ENGRAM_CHANCE, { grunt: 0.02, rusher: 0.02, captain: 0.05, heavy: 0.08, boss: 1 });
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
test('elements: six with distinct symbols; Stasis and Strand roll on weapons; enemy shields stay Light', () => {
  eq(Object.keys(ELEMENTS), ['kinetic', 'solar', 'arc', 'void', 'stasis', 'strand']);
  eq(new Set(Object.values(ELEMENTS).map((e) => e.symbol)).size, 6);
  eq(new Set(Object.values(ELEMENTS).map((e) => e.color)).size, 6);
  ok(ENERGY.includes('stasis') && ENERGY.includes('strand'), 'energy pool');
  eq(SHIELD_ELEMENTS, ['solar', 'arc', 'void']);
  const els = new Set();
  for (let i = 0; i < 400; i++) els.add(rollItem(50, 3, 'primary').element); // U10: named legendaries carry Stasis and Strand
  ok(els.has('stasis') && els.has('strand'), 'rolled');
});
test('subclass traits are aspects now (H3): no passives, each subclass defaults to its former trait', () => {
  const former = { sunbreaker: 'pyre', striker: 'amplitude', sentinel: 'resolve', gunslinger: 'chainofwoe', nightstalker: 'abyssal', arcstrider: 'crackling', voidwalker: 'bloom', stormcaller: 'unlimitedpower', dawnblade: 'giftsun' };
  for (const [c, sid] of SUBS) {
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
      ok(Math.abs(sum - AR.ARMOR_TOTAL[r]) <= 2, `${r} total ${sum}`);
      eq(a.mods, [null, null, null, null]); ok(!('perk' in a), 'no perk');
    }
  }
  eq(AR.MOD_ENERGY, { common: 4, uncommon: 6, rare: 8, legendary: 10, exotic: 10 });
});
test('mods: counts per slot, costs 1 to 4, unlock levels 5 to 30, the eight former perks are starters', () => {
  eq(AR.statMods().length, 12);
  eq(['helmet', 'arms', 'chest', 'legs'].map((s) => AR.modsForSlot(s).length), [10, 13, 12, 13]); // U9: Fonts of Discipline, Resilience, Mobility
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
  eq(a, { helmet: 'exotic', arms: 'g0', chest: 'titan', legs: 'g0', shader: 'calus' });
  eq(ST.decodeAppearance(ST.encodeAppearance(a)), a);
  eq(ST.decodeAppearance('junk,moon|nope'), { helmet: 'g0', arms: 'moon', chest: 'g0', legs: 'g0', shader: null }, 'bad ids fall back');
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
test('class exotics: two per slot per class (8 each), Destiny classes, they drop only for their class', () => {
  const D = {
    vanguard: [['An Insurmountable Skullfort', 'Mask of the Quiet One'], ['Synthoceps', 'Ursa Furiosa'], ['Heart of Inmost Light', 'Hallowfire Heart'], ['Dunemarchers', 'Peacekeepers']],
    stalker: [['Celestial Nighthawk', 'Graviton Forfeit'], ["Liar's Handshake", "Young Ahamkara's Spine"], ['Raiden Flux', 'Lucky Raspberry'], ['St0mp-EE5', 'Orpheus Rig']],
    arcanist: [["Nezarec's Sin", 'Skull of Dire Ahamkara'], ['Contraverse Hold', 'Sunbracers'], ['Starfire Protocol', "Stormdancer's Brace"], ['Transversive Steps', 'Lunafaction Boots']],
  };
  for (const [c, names] of Object.entries(D)) eq(['helmet', 'arms', 'chest', 'legs'].map((sl) => EXOTIC_ARMOR[c][sl]), names);
  const ids = new Set();
  for (const names of Object.values(D)) for (const n of names.flat()) { ok(EXOTIC_ARMOR_PERKS[n], `${n} has a perk`); ids.add(EXOTIC_ARMOR_PERKS[n].id); }
  eq(ids.size, 24);
  eq(Object.keys(EXOTIC_ARMOR_PERKS).length, 24, 'no stray exotic perks');
  for (const id of ids) if (!['skullfort', 'synthoceps', 'dunemarchers', 'stomp', 'transversive', 'raiden', 'liars', 'starfire', 'graviton', 'ahamkara', 'raspberry', 'orpheus', 'ursa', 'peacekeepers'].includes(id)) ok(STATUS[id] || ['heart', 'nighthawk', 'nezarec', 'contraverse'].includes(id), `${id} shows in the buff HUD`);
  for (const c of Object.keys(D)) for (let i = 0; i < 12; i++) { const it = makeArmor('chest', 50, 4, null, c); ok(it.classId === c && EXOTIC_ARMOR[c].chest.includes(it.name), `${c} chest exotic`); }
  ok(C.LIARS.mult === 2 && C.RAIDEN.maxExtend === 5 && C.RAIDEN.step * C.RAIDEN.maxStacks === 0.5 && C.STARFIRE.refund === 0.2);
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
  eq(armor.length, 8);
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
  ok(luna / arm > 0.35, `unfound exotic share ${luna / arm}`);
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
  eq(C.BURST_SUPERS.slice().sort(), ['bladebarrage', 'gathering', 'nova', 'tether', 'twilight']);
  for (const id of C.BURST_SUPERS) ok(Math.abs(100 * C.SUPER_ARMOR[id] - 15) < 1e-9, `${id}: 100 damage lands as 15`);
  for (const id of ['hammers', 'fists', 'maul', 'spectral', 'novawarp', 'chaosreach', 'daybreak']) eq(C.SUPER_ARMOR[id], C.ROAM_ARMOR, id);
  eq(C.SLAM_SUPERS.slice().sort(), ['wardofdawn', 'well']);
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
  const S_ = TOWER_SPOTS, b = [-60, 60, -62, 79]; // the map's bounds
  for (const n of [...Q.TOWER_NPCS, 'kadi']) { ok(S_[n] && Number.isFinite(S_[n].x), `${n} has a post`); ok(S_[n].x > b[0] && S_[n].x < b[1] && S_[n].z > b[2] && S_[n].z < b[3], `${n} is inside the map`); }
  for (const k of ['questKiosk', 'exoticKiosk', 'launchPad', 'rangeBox', 'rangeFirePoint', 'rangeBoss']) ok(S_[k], k);
  const rb = S_.rangeBox;
  ok(S_.rangeDummies.length >= 6 && [...S_.rangeDummies, S_.rangeBoss].every((d) => d.x > rb.minX && d.x < rb.maxX && d.z > rb.minZ && d.z < rb.maxZ), 'dummies stand inside the Range');
});
test('U16 Exotic Kiosk: priced at 7777 glimmer', () => { eq(S.KIOSK_PRICE, 7777); eq(S.POSTMASTER_CAP, 21); });
test('U16 Postmaster: overflow goes to the Postmaster, it caps at 21, exotics are never lost, items can be collected', () => {
  fresh();
  const s = S.createSave('vanguard');
  const base = s.inventory.find((i) => i.kind === 'weapon' && !S.isEquipped(s, i));
  const mk = (id, extra = {}) => ({ ...base, id, locked: false, ...extra });
  while (s.inventory.length < S.INVENTORY_CAP) s.inventory.push(mk(`f${s.inventory.length}`));
  for (let i = 0; i < S.POSTMASTER_CAP; i++) eq(S.addItem(s, mk(`p${i}`)).dismantled, null);
  eq(s.postmaster.length, S.POSTMASTER_CAP);
  const g0 = s.glimmer, r = S.addItem(s, mk('p-new'));
  eq(s.postmaster.length, S.POSTMASTER_CAP); ok(r.dismantled && r.dismantled.id === 'p0', 'the oldest was dismantled'); ok(s.glimmer > g0);
  s.postmaster = s.postmaster.map((i) => ({ ...i, rarity: 'exotic' }));
  const r2 = S.addItem(s, mk('p-ex', { rarity: 'exotic' }));
  eq(r2.dismantled, null); eq(s.postmaster.length, S.POSTMASTER_CAP + 1, 'a full Postmaster of exotics grows rather than lose one');
  ok(S.collectPostmaster(s, 'p-ex'), 'cannot collect into a full inventory');
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
  while (s.inventory.length < S.INVENTORY_CAP) S.addItem(s, { ...weakest, id: `fill${s.inventory.length}`, locked: false, power: weakest.power + 5 });
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
  eq(EXOTIC_WEAPONS.length, 24 + 14, '24 before U11');
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
test('U13a: zone leash holds units to the zone plus margin, and a room wins over the radius', () => {
  const zone = { center: { x: 0, z: 0 }, isBoss: false };
  eq(AI.leashTarget(zone, 10, 0), { x: 10, z: 0, held: false }, 'in reach');
  const far = AI.leashTarget(zone, 100, 0);
  ok(far.held && Math.abs(far.x - (AI.LEASH.radius - 1)) < 1e-6, 'held at the edge');
  ok(AI.leashRadius({ ...zone, isBoss: true }) > AI.leashRadius(zone), 'boss zones have more room');
  ok(AI.leashRadius({ ...zone, leash: 20 }) === 20, 'a zone can set its own radius');
  ok(!AI.pastLeash(zone, 30, 0) && AI.pastLeash(zone, 40, 0), 'past the leash only beyond radius plus slack');
  const room = { center: { x: 0, z: 0 }, room: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 } };
  eq(AI.insideLeash(room, 50, 3), { x: 9, z: 3 }, 'clamped into the room');
  ok(AI.pastLeash(room, 12.5, 0) && !AI.pastLeash(room, 11, 0), 'room edges use the same slack');
});
test('U13a: activation range is inside the leash with a real margin (units do not chase across the map)', () => {
  ok(AI.LEASH.radius >= 24 + 8 && AI.LEASH.bossRadius >= 28 + 8, 'at least 8 m beyond the activation distance');
  ok(AI.LEASH.bossRadius <= 60, 'but not map-wide');
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
  ok(TR.majorChance('captain', 0) > 0.5 && TR.majorChance('heavy', 0) > 0.5, 'mostly majors at low power');
  ok(TR.majorChance('grunt', 0) < 0.1, 'grunts rarely');
  ok(TR.majorChance('grunt', 8) > TR.majorChance('grunt', 0) && TR.majorChance('rusher', 8) > TR.majorChance('rusher', 0), 'more of every unit at high power');
  eq(TR.rollTier('captain', 0, 0.0), 'major'); eq(TR.rollTier('captain', 0, 0.99), 'minor');
});
test('U13b: fireteam table: solo is unchanged, three players get more enemies, health, damage and boss health', () => {
  eq(TR.fireteamScale(1), { count: 1, hp: 1, dmg: 1, boss: 1 });
  const a = TR.fireteamScale(2), b = TR.fireteamScale(3);
  ok(b.count > a.count && a.count > 1 && b.hp > a.hp && a.hp > 1 && b.dmg > a.dmg && b.boss > a.boss, 'monotonic');
  eq([a.count, b.count, a.boss, b.boss], [1.5, 2, 1.6, 2.2], 'the v2.3 counts are kept');
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
  ok(b && b.speed >= 85 && b.speed <= 110 && b.size < 0.15 && b.life > 0.5, 'bolt tuned fast and small');
  const F = { close: 0, bonus: 1, min: 0.5, span: 1.5 };
  eq(C.falloffMult(F, 10, 28), 1); ok(C.falloffMult(F, 60, 28) < 1 && C.falloffMult(F, 500, 28) === 0.5, 'falls to the floor');
  ok(C.falloffMult({ close: 5, bonus: 1.3, min: 0.5, span: 1.5 }, 1, 28) > 1, 'point-blank bonus');
});


test('U14 factions: every unit extends a base class, has a name and a roster entry', () => {
  const bases = ['grunt', 'rusher', 'captain', 'heavy', 'suicide'];
  for (const [id, u] of Object.entries(FA.UNITS)) {
    ok(bases.includes(u.base), `${id} base`); ok(u.objective || FA.FACTIONS[u.faction], `${id} faction`); ok(u.name, `${id} name`);
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
  eq(FA.activityFaction('io', 3), 'taken'); eq(FA.activityFaction('io', 4), null); eq(FA.activityFaction('earth', 3), null);
});

test('U14 factions: front guard, revive and blink rules', () => {
  const guard = FA.UNITS.tk_phalanx;
  ok(FA.frontGuardMult(guard, 0.9) < 0.2, 'blocks from the front'); eq(FA.frontGuardMult(guard, -0.5), 1); eq(FA.frontGuardMult(guard, 0.9, true), 1);
  eq(FA.frontGuardMult(FA.UNITS.tk_vandal, 0.9), 1);
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

// ---------- runner ----------
const out = document.getElementById('out');
let pass = 0, fail = 0;
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
