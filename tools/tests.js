// Afterlight unit tests: pure logic only (progression, loot, save, data, releases, status effects, combat rules).
// Open tools/tests.html on the running dev server. Uses an in-memory store, so the real save is never touched.
import { CLASSES, LOCATIONS, ARCHETYPES, EXOTIC_WEAPONS, RARITIES } from '../js/data.js';
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
test('save v2 upgrades to v3: subclass choice kept, loadout defaults, nothing else touched', () => {
  const v2 = { version: 2, classId: 'stalker', glimmer: 777, inventory: [{ id: 'a', slot: 'primary', power: 50 }], vault: [], equipped: { primary: 'a' }, cleared: { e1: true }, subclass: { stalker: 'nightstalker' }, progression: { xp: 0, claimed: [] }, settings: {} };
  const st = fresh({ afterlight_save_v2: JSON.stringify(v2) });
  const s = S.loadSave();
  eq(s.version, 3); eq(S.SAVE_VERSION, 3);
  eq(s.loadout, {}); eq(s.glimmer, 777); eq(s.subclass, { stalker: 'nightstalker' }); eq(s.cleared, { e1: true }); eq(s.inventory.length, 1);
  eq(JSON.parse(st.getItem('afterlight_save_v2')).version, 3, 'written back');
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

// ---------- Update Log / Roadmap ----------
test('Update Log: unique versions, newest first, complete entries', () => {
  const v = RELEASES.map((r) => r.version.split('.').map(Number));
  for (let i = 1; i < v.length; i++) ok(v[i - 1][0] > v[i][0] || (v[i - 1][0] === v[i][0] && v[i - 1][1] > v[i][1]), `order at ${i}`);
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
