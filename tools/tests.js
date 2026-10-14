// Afterlight unit tests: pure logic only (progression, loot, save, data, releases, status effects, combat rules).
// Open tools/tests.html on the running dev server. Uses an in-memory store, so the real save is never touched.
import { CLASSES, LOCATIONS, ARCHETYPES, EXOTIC_WEAPONS, RARITIES, ELEMENTS, EXOTIC_ARMOR, EXOTIC_ARMOR_PERKS } from '../js/data.js';
import { LEVEL_CAP, LIGHT_CAP, XP, xpToNext, xpForLevel, levelInfo, rewardAt, rarityWeights, rollRarity, subclassLevel, subclassesUnlockedAt, RARITY_CURVE } from '../js/progression.js';
import { rollItem } from '../js/loot.js';
import * as S from '../js/save.js';
import { mulberry32 } from '../js/util.js';
import { RELEASES, ROADMAP, ROADMAP_STATUSES } from '../js/releases.js';
import { StatusSet, STATUS } from '../js/status.js';
import * as C from '../js/combat.js';
import * as SC from '../js/subclass.js';
import { ENEMY_STATUS, WEAKEN_MULT } from '../js/status.js';
import { abilityIcon } from '../js/ability-icons.js';
import { FRAMES, LEGENDARY_WEAPONS, framesFor, weaponStats, weaponHandling, frameFor } from '../js/frames.js';
import { ENERGY, SHIELD_ELEMENTS } from '../js/data.js';
import { readyState } from '../js/net.js';
import * as AR from '../js/armor.js';
import { makeArmor } from '../js/loot.js';
import * as ST from '../js/style.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function eq(a, b, msg = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg); }

function memStore(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m };
}
const fresh = (init) => { const st = memStore(init); S.useStorage(st); return st; };

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
test('reward track: legendary every 3 levels, exotic at 20 and 40', () => {
  const leg = [], exo = [];
  for (let L = 1; L <= LEVEL_CAP; L++) { if (rewardAt(L) === 'legendary') leg.push(L); if (rewardAt(L) === 'exotic') exo.push(L); }
  eq(exo, [20, 40]);
  eq(leg, [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39]);
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
  eq(new Set(s.inventory.filter((i) => i.kind === 'weapon').map((i) => i.arch)).size, Object.keys(ARCHETYPES).length);
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
  ok(r.item && r.item.rarity === 'legendary', 'legendary at 3');
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
  ok(C.SONG.abilityRegen < 8, 'ability regen during Song toned down');
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
test('registry: 3 grenades per element, 2 class abilities per class, 3 aspects per subclass, 14 fragments', () => {
  for (const el of ['solar', 'arc', 'void']) eq(SC.grenadesFor(el).length, 3, el);
  for (const c of Object.keys(CLASSES)) eq(SC.classAbilitiesFor(c).length, 2, c);
  for (const [c, sid] of SUBS) eq(SC.aspectsFor(c, sid).length, 3, sid);
  eq(Object.keys(SC.ASPECTS).length, 27);
  eq([SC.fragmentsFor('solar').length, SC.fragmentsFor('arc').length, SC.fragmentsFor('void').length], [4, 5, 5]);
  for (const a of Object.values(SC.ASPECTS)) ok(a.slots === 1 || a.slots === 2, a.name);
});
test('every default loadout is valid and resolves to the v1.2 abilities', () => {
  const v12 = { // grenade, grenade cd, class ability, class cd
    sunbreaker: ['solar', 22, 'barricade', 26], striker: ['pulse', 20, 'barricade', 26], sentinel: ['suppressor', 22, 'ward', 34],
    gunslinger: ['swarm', 20, 'marksman', 10], nightstalker: ['axion', 20, 'marksman', 12], arcstrider: ['flux', 20, 'gambler', 9],
    voidwalker: ['vortex', 24, 'rift', 32], stormcaller: ['storm', 22, 'empower', 32], dawnblade: ['solar', 12, 'rift', 32],
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
  const two = SC.sanitizeLoadout('arcanist', 'voidwalker', { aspects: ['chaos', 'childgods'], fragments: ['expulsion', 'expulsion', 'persistence', 'starvation'] }, 40);
  eq(two.fragments, ['expulsion', 'persistence']);
  eq(SC.fragmentSlots(['feedvoid', 'chaos']), 3);
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
  eq(SC.cooldownMults(['bastion']).class, 1.3);
  eq(SC.cooldownMults([]), { grenade: 1, melee: 1, class: 1 });
  eq(SC.regenMult([]), 1);
  ok(Math.abs(SC.regenMult([1.5, 1.2]) - 1.8) < 1e-9, 'boosts multiply');
  eq(SC.regenMult([1.5, 1.5, 1.5, 1.2]), SC.REGEN_CAP);
});
test('save v2 upgrades to the current version: subclass choice kept, loadout defaults, nothing else touched', () => {
  const v2 = { version: 2, classId: 'stalker', glimmer: 777, inventory: [{ id: 'a', slot: 'primary', power: 50 }], vault: [], equipped: { primary: 'a' }, cleared: { e1: true }, subclass: { stalker: 'nightstalker' }, progression: { xp: 0, claimed: [] }, settings: {} };
  const st = fresh({ afterlight_save_v2: JSON.stringify(v2) });
  const s = S.loadSave();
  eq(s.version, 6); eq(S.SAVE_VERSION, 6);
  eq(s.loadout, {}); eq(s.glimmer, 777); eq(s.subclass, { stalker: 'nightstalker' }); eq(s.cleared, { e1: true }); eq(s.inventory.length, 1);
  eq(JSON.parse(st.getItem('afterlight_save_v2')).version, 6, 'written back');
  const k = S.activeKit(s);
  eq([k.subclassId, k.abilities.grenade.id, k.abilities.class.id, k.aspects], ['nightstalker', 'axion', 'marksman', ['vanishing']]);
});
test('setLoadout saves a valid loadout per subclass; activeKit uses it', () => {
  fresh();
  const s = S.createSave('vanguard');
  eq(s.loadout, {});
  S.setLoadout(s, 'vanguard', 'sunbreaker', { grenade: 'healing', class: 'rally', aspects: ['roaring', 'solinvictus'], fragments: ['torches', 'ashes', 'singeing', 'empyrean'] });
  eq(S.getLoadout(s, 'vanguard', 'sunbreaker'), { grenade: 'healing', class: 'rally', aspects: ['roaring', 'solinvictus'], fragments: ['torches', 'ashes', 'singeing'] });
  const k = S.activeKit(s);
  eq([k.abilities.grenade.name, k.abilities.class.name, k.fragments.length], ['Healing Grenade', 'Rally Barricade', 3]);
  eq(S.getLoadout(s, 'vanguard', 'striker'), SC.defaultLoadout('vanguard', 'striker'), 'other subclasses untouched');
  // dropping an aspect drops the fragments it opened
  eq(S.setLoadout(s, 'vanguard', 'sunbreaker', { aspects: ['solinvictus'] }).fragments, ['torches']);
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
    melee: SUBS.map(([c, sid]) => CLASSES[c].subclasses[sid].abilities.melee.id), super: SUBS.map(([c, sid]) => CLASSES[c].subclasses[sid].abilities.super.id),
  };
  for (const [slot, ids] of Object.entries(groups)) {
    const unique = [...new Set(ids)];
    const svgs = new Set(unique.map((id) => abilityIcon(slot, id, '#fff')));
    eq(svgs.size, unique.length, `${slot} icons`);
  }
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
test('Celestial Nighthawk: Golden Gun only, 4x single shot, kill refunds 30% super', () => {
  eq(C.NIGHTHAWK, { goldenGun: 4, refund: 30 });
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
    ok(framesFor(id).length >= 2, `${id} has frames`);
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
  for (const id of Object.keys(ARCHETYPES)) ok(LEGENDARY_WEAPONS.filter((l) => l.arch === id).length >= 4, `${id} legendaries`);
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
    const A = weaponHandling(item), s = weaponStats(item), shot = s.dmg * (A.pellets || 1) * (A.chargeBurst || 1);
    const cycle = A.mode === 'burst' ? ((A.burst - 1) * 60 / s.rpm + A.burstDelay) / A.burst : A.mode === 'charge' ? A.charge + 60 / s.rpm : 60 / s.rpm;
    return shot / cycle;
  };
  for (const arch of Object.keys(ARCHETYPES)) {
    const vals = framesFor(arch).filter((f) => f !== 'wave').map((f) => [f, dps({ arch, frame: f, rarity: 'legendary', slot: ARCHETYPES[arch].slot })]);
    const mid = vals.reduce((a, [, v]) => a + v, 0) / vals.length;
    for (const [f, v] of vals) ok(Math.abs(v / mid - 1) <= 0.15, `${arch} ${f}: ${(v / mid).toFixed(2)}x the family average`);
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
  fresh({ afterlight_save_v2: JSON.stringify(v3) });
  const s = S.loadSave();
  eq(s.version, 6);
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
  for (let i = 0; i < 400; i++) els.add(rollItem(50, 1, 'special').element);
  ok(els.has('stasis') && els.has('strand'), 'rolled');
});
test('every subclass has a trait; the six new ones have tuning', () => {
  for (const c of Object.values(CLASSES)) for (const [id, sc] of Object.entries(c.subclasses)) ok(sc.passive, `${id} trait`);
  eq(Object.keys(SC.TRAITS).sort(), ['gunslinger', 'nightstalker', 'stormcaller', 'striker', 'sunbreaker', 'voidwalker']);
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
test('title shows the newest update: name, version and artwork', () => {
  const r = RELEASES[0];
  ok(r.name && r.version && /^<svg[\s\S]*<\/svg>$/.test(r.art), 'art');
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
  ok(Math.abs(AR.regenRate(st.int) - 90) <= 3, 'regen rate');
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
  eq(['helmet', 'arms', 'chest', 'legs'].map((s) => AR.modsForSlot(s).length), [10, 12, 11, 12]);
  eq(AR.MOD_IDS.length, 57);
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
  fresh({ afterlight_save_v2: JSON.stringify(v4) });
  const s = S.loadSave();
  eq(s.version, 6);
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
  fresh({ afterlight_save_v2: JSON.stringify(v4) });
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
  eq(n, 23);
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
  fresh({ afterlight_save_v2: JSON.stringify(v5) });
  const s = S.loadSave();
  eq(s.version, 6);
  eq(s.shaders, { owned: [], applied: {} });
  const [L1, R1, X1] = s.inventory;
  ok(ST.SET_IDS.includes(L1.set) && ST.SET_IDS.includes(s.vault[0].set), 'legendaries get a set');
  ok(!('set' in R1) && !('set' in X1), 'rare and exotic stay out');
  ok([...s.inventory, ...s.vault].every((it) => it.classId === 'vanguard'), 'every armor piece belongs to the class being played');
  eq(X1.name, 'Heart of Inmost Light', 'an exotic becomes that class\'s exotic for its slot');
  eq(s.chars, {});
  for (const it of [L1, R1]) eq(it.name, inv.find((x) => x.id === it.id).name);
  for (const it of [L1, R1, X1]) { eq(it.power, 120); eq(it.mods, [null, 'handson', null, null]); eq(it.stats.mob, 9); }
  fresh({ afterlight_save_v2: JSON.stringify(v5) });
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
test('class exotics: one per slot per class, Destiny classes, they drop only for their class', () => {
  const D = { vanguard: ['An Insurmountable Skullfort', 'Synthoceps', 'Heart of Inmost Light', 'Dunemarchers'], stalker: ['Celestial Nighthawk', "Liar's Handshake", 'Raiden Flux', 'St0mp-EE5'], arcanist: ["Nezarec's Sin", 'Contraverse Hold', 'Starfire Protocol', 'Transversive Steps'] };
  for (const [c, names] of Object.entries(D)) eq(['helmet', 'arms', 'chest', 'legs'].map((sl) => EXOTIC_ARMOR[c][sl]), names);
  const ids = new Set();
  for (const names of Object.values(D)) for (const n of names) { ok(EXOTIC_ARMOR_PERKS[n], `${n} has a perk`); ids.add(EXOTIC_ARMOR_PERKS[n].id); }
  eq(ids.size, 12);
  eq(Object.keys(EXOTIC_ARMOR_PERKS).length, 12, 'the removed exotics are gone');
  for (const c of Object.keys(D)) for (let i = 0; i < 8; i++) { const it = makeArmor('chest', 50, 4, null, c); eq([it.classId, it.name], [c, EXOTIC_ARMOR[c].chest]); }
  ok(C.LIARS.mult === 2 && C.RAIDEN.maxExtend === 5 && C.RAIDEN.step * C.RAIDEN.maxStacks === 0.5 && C.STARFIRE.refund === 0.2);
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
